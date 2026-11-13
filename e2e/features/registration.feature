Feature: Self-registration in portal mode
  New users create an account; the page then asks them to confirm their address. The ALTCHA proof of work is
  solved by the real widget in the browser and checked by the fake backend.

  Background:
    Given the app runs in portal mode
    And I open the page "/registrieren"

  Scenario: Registering asks to confirm the email address
    When I fill in "E-Mail" with "new-rider@example.org"
    And I fill in "Passwort" with "Kette-und-Ritzel-42"
    And I fill in "Passwort wiederholen" with "Kette-und-Ritzel-42"
    And the captcha has been solved
    And I click "Konto anlegen"
    Then I see the heading "Bitte prüfe dein Postfach"
    And I see the text "Wir haben eine E-Mail an new-rider@example.org geschickt."
    And the backend received a registration for "new-rider@example.org" in language "de"

  Scenario: Passwords that do not match are not sent
    When I fill in "E-Mail" with "new-rider@example.org"
    And I fill in "Passwort" with "Kette-und-Ritzel-42"
    And I fill in "Passwort wiederholen" with "Kette-und-Ritzel-43"
    And I click "Konto anlegen"
    Then I see the error "Die Passwörter stimmen nicht überein."
    And the backend received no registration

  Scenario: The login page links to the registration
    Given I open the page "/anmelden"
    When I click "Noch kein Konto? Konto anlegen"
    Then I am on the page "/registrieren"
    And I see the heading "Konto anlegen"
