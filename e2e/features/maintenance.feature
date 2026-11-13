Feature: Maintenance tasks and records of a vehicle

  Background:
    Given the app runs in portal mode
    And I am logged in as "rider@example.org"
    And a motorcycle "Tenere" with 19600 km exists

  Scenario: Creating a maintenance task
    Given I open the app
    And I open the vehicle "Tenere"
    When I open the tab "Wartungsaufgaben"
    And I fill in "Name *" with "Kette schmieren"
    And I fill in "Intervall (km)" with "1000"
    And I click "Aufgabe anlegen"
    Then I see the text "Kette schmieren"
    When I open the tab "Dashboard & Status"
    Then the task card "Kette schmieren" shows "Ausstehend"

  Scenario: Recording a maintenance with a performed task
    Given the vehicle "Tenere" has the task "Ölwechsel" every 10000 km
    And I open the app
    And I open the vehicle "Tenere"
    When I open the tab "Wartung erfassen"
    And I fill in "Datum" with "2026-11-01"
    And I fill in "Kilometerstand" with "19800"
    And I check "Ölwechsel"
    And I fill in "Notizen" with "Motul 10W-40"
    And I click "Wartung speichern"
    Then the backend stored a maintenance log for "Tenere" at 19800 km with the task "Ölwechsel"
    When I open the tab "Wartungshistorie"
    Then I see the text "19.800 km"
    And I see the text "Motul 10W-40"
    When I open the tab "Dashboard & Status"
    Then the task card "Ölwechsel" shows "Letzter Service: 19.800 km"

  Scenario: Without records the history is empty
    Given I open the app
    And I open the vehicle "Tenere"
    When I open the tab "Wartungshistorie"
    Then I see the text "Noch keine Wartungen erfasst."
