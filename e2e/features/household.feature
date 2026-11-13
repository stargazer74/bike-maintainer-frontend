Feature: Profile selection in household mode
  In the home network nobody logs in: everyone picks their password-less profile.

  Background:
    Given the app runs in household mode
    And the household has the profiles:
      | Anna |
      | Ben  |

  Scenario: The app starts with the profile selection
    When I open the app
    Then I am on the page "/person-waehlen"
    And I see the heading "Wer bist du?"
    And I see a button "Anna"
    And I see a button "Ben"

  Scenario: Picking a profile opens the dashboard
    Given I open the app
    When I click "Anna"
    Then I am on the page "/dashboard"
    And I see the heading "Dashboard"

  Scenario: Adding a new person
    Given I open the app
    When I fill in "Neue Person" with "Carla"
    And I click "Hinzufügen"
    Then I see a button "Carla"

  Scenario: The login page does not exist in household mode
    When I open the page "/anmelden"
    Then I am on the page "/person-waehlen"

  Scenario: Switching the person leads back to the profile selection
    Given I open the app
    And I click "Ben"
    When I open the user menu
    And I click "Person wechseln"
    Then I am on the page "/person-waehlen"
