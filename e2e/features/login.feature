Feature: Login in portal mode
  Visitors without a session land on the login page; after logging in they reach the dashboard.

  Background:
    Given the app runs in portal mode
    And an account "rider@example.org" with password "Kette-und-Ritzel-42" exists

  Scenario: A visitor without a session is sent to the login page
    When I open the app
    Then I am on the page "/anmelden"
    And I see the heading "Anmelden"

  Scenario: Logging in leads to the dashboard
    Given I open the app
    When I fill in "E-Mail" with "rider@example.org"
    And I fill in "Passwort" with "Kette-und-Ritzel-42"
    And I click "Anmelden"
    Then I am on the page "/dashboard"
    And I see the heading "Dashboard"

  Scenario: A wrong password is rejected
    Given I open the app
    When I fill in "E-Mail" with "rider@example.org"
    And I fill in "Passwort" with "falsches-Passwort"
    And I click "Anmelden"
    Then I see the error "E-Mail oder Passwort falsch."
    And I am on the page "/anmelden"

  Scenario: Empty fields are not sent
    Given I open the app
    When I click "Anmelden"
    Then I see the error "Bitte E-Mail und Passwort eingeben."
    And I am on the page "/anmelden"

  Scenario: An unverified email address cannot log in yet
    Given an unverified account "new@example.org" exists
    And I open the app
    When I fill in "E-Mail" with "new@example.org"
    And I fill in "Passwort" with "Kette-und-Ritzel-42"
    And I click "Anmelden"
    Then I see the error "Deine E-Mail-Adresse ist noch nicht bestätigt."

  Scenario: An existing session skips the login page
    Given I am logged in as "rider@example.org"
    When I open the page "/anmelden"
    Then I am on the page "/dashboard"

  Scenario: Logging out leads back to the login page
    Given I am logged in as "rider@example.org"
    And I open the app
    When I open the user menu
    And I click "Abmelden"
    Then I am on the page "/anmelden"
