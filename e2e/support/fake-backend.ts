import type { Page, Request, Route } from '@playwright/test';
import { createChallenge, pbkdf2, verifySolution, type Payload } from 'altcha/lib';
// The model files only, not the barrel of the client: that one pulls in the Angular services.
import {
  AccessStatus,
  type AppConfigResponse,
  type Currency,
  type Language,
  type MaintenanceLogRequest,
  type MaintenanceLogResponse,
  type MaintenanceTaskRequest,
  type MaintenanceTaskResponse,
  MaintenanceTaskStatus,
  OperatingMode,
  type ProfileResponse,
  type UserResponse,
  UserRole,
  type VehicleRequest,
  type VehicleResponse,
} from '../../src/app/api-client/model/models';

/** HMAC secret of the fake ALTCHA challenges; only ever used inside the test run. */
const ALTCHA_SECRET = 'e2e-only';

interface Account {
  user: UserResponse;
  password: string;
}

interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

interface Reply {
  status: number;
  body?: unknown;
}

const json = (status: number, body?: unknown): Reply => ({ status, body });
const notFound = (): Reply => json(404, { status: 404, error: 'Not Found' });

/**
 * In-memory stand-in for the backend, answering every `/api/` request of the browser (`page.route`). It keeps
 * just enough state for the scenarios: accounts or household profiles, the session, vehicles, tasks and logs.
 * Requests it does not know are answered with 501 and collected in `unhandled`, so a scenario fails instead of
 * silently testing against a missing endpoint. Shapes come from the generated API client, so the fake follows
 * the contract.
 */
export class FakeBackend {
  mode: OperatingMode = OperatingMode.Portal;
  readonly accounts: Account[] = [];
  readonly profiles: ProfileResponse[] = [];
  readonly vehicles: VehicleResponse[] = [];
  readonly tasks: MaintenanceTaskResponse[] = [];
  readonly logs: MaintenanceLogResponse[] = [];
  readonly requests: RecordedRequest[] = [];
  readonly unhandled: string[] = [];
  /** Registrations the backend accepted (only with a solved ALTCHA). */
  readonly registrations: { email: string; language?: Language }[] = [];
  private sessionUser: UserResponse | null = null;
  private nextId = 1;

  async attach(page: Page): Promise<void> {
    await page.route('**/api/**', (route) => this.handle(route));
  }

  // ---- seeding ---------------------------------------------------------------------------------

  addAccount(email: string, password: string, options: Partial<UserResponse> = {}): UserResponse {
    const user = this.newUser({ email, ...options });
    this.accounts.push({ user, password });
    return user;
  }

  addProfile(displayName: string): ProfileResponse {
    const profile: ProfileResponse = { id: this.id(), displayName, vehicleCount: 0 };
    this.profiles.push(profile);
    return profile;
  }

  /** Starts with this account logged in, as if the session cookie were still valid. */
  logIn(email: string): void {
    this.sessionUser = this.findAccount(email)?.user ?? null;
    if (!this.sessionUser) {
      throw new Error(`No account ${email}`);
    }
  }

  addVehicle(request: VehicleRequest): VehicleResponse {
    const now = new Date().toISOString();
    const vehicle: VehicleResponse = { ...request, id: this.id(), createdAt: now, updatedAt: now };
    this.vehicles.push(vehicle);
    return vehicle;
  }

  addTask(vehicleId: number, request: MaintenanceTaskRequest): MaintenanceTaskResponse {
    const task: MaintenanceTaskResponse = {
      vehicleId,
      oneTime: false,
      active: true,
      ...request,
      id: this.id(),
      status: MaintenanceTaskStatus.Ok,
    };
    this.tasks.push(task);
    return task;
  }

  addLog(vehicleId: number, request: MaintenanceLogRequest): MaintenanceLogResponse {
    const log: MaintenanceLogResponse = {
      id: this.id(),
      vehicleId,
      performedAt: request.performedAt,
      mileageAtPerformed: request.mileageAtPerformed,
      notes: request.notes,
      performedTaskIds: request.performedTaskIds ?? [],
      materials: [],
      currency: this.sessionUser?.currency ?? ('EUR' as Currency),
      createdAt: new Date().toISOString(),
    };
    this.logs.push(log);
    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    if (vehicle && log.mileageAtPerformed > vehicle.currentMileage) {
      vehicle.currentMileage = log.mileageAtPerformed;
    }
    return log;
  }

  vehicleByName(name: string): VehicleResponse {
    const vehicle = this.vehicles.find((v) => v.name === name);
    if (!vehicle) {
      throw new Error(`No vehicle ${name}`);
    }
    return vehicle;
  }

  /** Last recorded request with this method and path (path pattern may use `*` for one segment). */
  lastRequest(method: string, pathPattern: string): RecordedRequest | undefined {
    const pattern = new RegExp('^' + pathPattern.replace(/\*/g, '[^/]+') + '$');
    return this.requests.filter((r) => r.method === method && pattern.test(r.path)).at(-1);
  }

  // ---- routing ---------------------------------------------------------------------------------

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = parseBody(request);
    this.requests.push({ method, path, body });

    let reply: Reply | undefined;
    try {
      reply = await this.dispatch(method, path, body);
    } catch (error) {
      reply = json(500, { status: 500, message: String(error) });
    }
    if (!reply) {
      this.unhandled.push(`${method} ${path}`);
      reply = json(501, { status: 501, error: 'Not implemented in FakeBackend' });
    }
    await route.fulfill({
      status: reply.status,
      contentType: 'application/json',
      body: reply.body === undefined ? '' : JSON.stringify(reply.body),
    });
  }

  private async dispatch(method: string, path: string, body: unknown): Promise<Reply | undefined> {
    const p = path.replace(/^\/api\/v1/, '');
    const route = `${method} ${p}`;

    if (route === 'GET /config') {
      const config: AppConfigResponse = { mode: this.mode };
      return json(200, config);
    }
    const auth = this.dispatchAuth(route, body);
    if (auth) {
      return auth;
    }
    if (route === 'GET /auth/challenge') {
      return this.mode === OperatingMode.Portal ? json(200, await this.challenge()) : notFound();
    }
    if (route === 'POST /auth/register') {
      return this.register(body as { email: string; altcha: string; language?: Language });
    }
    if (p.startsWith('/profiles')) {
      return this.dispatchProfiles(method, p, body);
    }
    if (!this.sessionUser) {
      return json(401, { status: 401, error: 'Unauthorized' });
    }
    if (p.startsWith('/vehicles')) {
      return this.dispatchVehicles(method, p, body);
    }
    return undefined;
  }

  private dispatchAuth(route: string, body: unknown): Reply | undefined {
    switch (route) {
      case 'GET /auth/me':
        return this.sessionUser ? json(200, this.sessionUser) : json(401);
      case 'PATCH /auth/me': {
        if (!this.sessionUser) {
          return json(401);
        }
        const patch = body as { language?: Language; currency?: Currency };
        Object.assign(this.sessionUser, patch);
        return json(200, this.sessionUser);
      }
      case 'POST /auth/login': {
        if (this.mode !== OperatingMode.Portal) {
          return notFound();
        }
        const { email, password } = body as { email: string; password: string };
        const account = this.findAccount(email);
        if (!account || account.password !== password) {
          return json(401, { status: 401, code: 'BAD_CREDENTIALS' });
        }
        if (!account.user.emailVerified) {
          return json(403, { status: 403, code: 'EMAIL_NOT_VERIFIED' });
        }
        this.sessionUser = account.user;
        return json(200, account.user);
      }
      case 'POST /auth/logout':
        this.sessionUser = null;
        return json(204);
      default:
        return undefined;
    }
  }

  private dispatchProfiles(method: string, p: string, body: unknown): Reply | undefined {
    if (this.mode !== OperatingMode.Household) {
      return notFound();
    }
    if (method === 'GET' && p === '/profiles') {
      return json(200, this.profiles);
    }
    if (method === 'POST' && p === '/profiles') {
      const name = (body as { displayName: string }).displayName.trim();
      if (this.profiles.some((profile) => profile.displayName === name)) {
        return json(409, { status: 409, code: 'PROFILE_NAME_TAKEN' });
      }
      return json(201, this.addProfile(name));
    }
    const select = /^\/profiles\/(\d+)\/select$/.exec(p);
    if (method === 'POST' && select) {
      const profile = this.profiles.find((x) => x.id === Number(select[1]));
      if (!profile) {
        return notFound();
      }
      this.sessionUser = this.newUser({ id: profile.id, displayName: profile.displayName });
      return json(200, this.sessionUser);
    }
    return undefined;
  }

  private dispatchVehicles(method: string, p: string, body: unknown): Reply | undefined {
    if (p === '/vehicles') {
      if (method === 'GET') {
        return json(200, this.vehicles);
      }
      if (method === 'POST') {
        return json(201, this.addVehicle(body as VehicleRequest));
      }
      return undefined;
    }
    const match = /^\/vehicles\/(\d+)(\/.*)?$/.exec(p);
    const vehicle = match && this.vehicles.find((v) => v.id === Number(match[1]));
    if (!match || !vehicle) {
      return notFound();
    }
    const sub = `${method} ${match[2] ?? ''}`;
    const vehicleTasks = () => this.tasks.filter((t) => t.vehicleId === vehicle.id);
    const vehicleLogs = () => this.logs.filter((l) => l.vehicleId === vehicle.id);

    switch (sub) {
      case 'GET ':
        return json(200, vehicle);
      case 'PUT ':
        Object.assign(vehicle, body as VehicleRequest, { updatedAt: new Date().toISOString() });
        return json(200, vehicle);
      case 'GET /maintenance-tasks':
        return json(
          200,
          vehicleTasks().map((task) => this.withStatus(task, vehicle)),
        );
      case 'POST /maintenance-tasks':
        return json(
          201,
          this.withStatus(this.addTask(vehicle.id, body as MaintenanceTaskRequest), vehicle),
        );
      case 'GET /maintenance-logs':
        return json(200, vehicleLogs());
      case 'POST /maintenance-logs':
        return json(201, this.addLog(vehicle.id, body as MaintenanceLogRequest));
      case 'GET /cost-summary':
        return json(200, []);
      case 'GET /worksheets':
        return json(200, []);
      case 'GET /specifications':
        return json(200, {});
      case 'GET /measurements/latest':
        return json(200, { measurements: {}, sources: {} });
      default:
        return undefined;
    }
  }

  // ---- behaviour -------------------------------------------------------------------------------

  /** A real, cheap ALTCHA challenge, so the widget in the browser actually solves it. */
  private async challenge(): Promise<unknown> {
    return createChallenge({
      algorithm: 'PBKDF2/SHA-256',
      cost: 10,
      deriveKey: pbkdf2.deriveKey,
      hmacSignatureSecret: ALTCHA_SECRET,
    });
  }

  private async register(request: {
    email: string;
    altcha: string;
    language?: Language;
  }): Promise<Reply> {
    if (this.mode !== OperatingMode.Portal) {
      return notFound();
    }
    const result = await verifySolution({
      ...decodePayload(request.altcha),
      hmacSignatureSecret: ALTCHA_SECRET,
      deriveKey: pbkdf2.deriveKey,
    }).catch(() => null);
    if (!result?.verified) {
      return json(400, { status: 400, code: 'CAPTCHA_INVALID' });
    }
    this.registrations.push({ email: request.email, language: request.language });
    return json(202);
  }

  /**
   * Simplified status: only the km interval counts (due at last service + interval, or at the first due
   * km); within 10 % of the interval it is due soon. Enough to see status changes in the UI; the real
   * rules are tested in the backend.
   */
  private withStatus(
    task: MaintenanceTaskResponse,
    vehicle: VehicleResponse,
  ): MaintenanceTaskResponse {
    const performed = this.logs
      .filter((log) => log.vehicleId === vehicle.id && log.performedTaskIds?.includes(task.id))
      .sort((a, b) => b.mileageAtPerformed - a.mileageAtPerformed)[0];
    const result: MaintenanceTaskResponse = {
      ...task,
      lastServiceMileage: performed?.mileageAtPerformed,
      lastServiceDate: performed?.performedAt,
    };
    if (!task.intervalKm) {
      return { ...result, status: MaintenanceTaskStatus.Ok };
    }
    const dueAt = performed
      ? performed.mileageAtPerformed + task.intervalKm
      : (task.firstDueKm ?? task.intervalKm);
    const kmRemaining = dueAt - vehicle.currentMileage;
    const fraction = kmRemaining / task.intervalKm;
    return {
      ...result,
      kmRemaining,
      remainingFraction: fraction,
      progress: Math.min(1, Math.max(0, 1 - fraction)),
      status:
        kmRemaining < 0
          ? MaintenanceTaskStatus.Overdue
          : fraction <= 0.1
            ? MaintenanceTaskStatus.DueSoon
            : MaintenanceTaskStatus.Ok,
    };
  }

  private newUser(options: Partial<UserResponse>): UserResponse {
    return {
      id: this.id(),
      role: UserRole.User,
      active: true,
      emailVerified: true,
      language: 'de' as Language,
      currency: 'EUR' as Currency,
      createdAt: new Date().toISOString(),
      accessStatus: this.mode === OperatingMode.Portal ? AccessStatus.Trial : AccessStatus.Full,
      hasSubscription: false,
      ...options,
    };
  }

  private findAccount(email: string): Account | undefined {
    return this.accounts.find((a) => a.user.email?.toLowerCase() === email.toLowerCase());
  }

  private id(): number {
    return this.nextId++;
  }
}

function parseBody(request: Request): unknown {
  const data = request.postData();
  if (!data) {
    return undefined;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/** The widget sends challenge and solution as Base64-encoded JSON. */
function decodePayload(payload: string): Payload {
  return JSON.parse(Buffer.from(payload ?? '', 'base64').toString('utf8')) as Payload;
}
