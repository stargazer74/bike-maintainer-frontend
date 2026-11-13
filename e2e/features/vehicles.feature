Feature: Vehicles on the dashboard

  Background:
    Given the app runs in portal mode
    And I am logged in as "rider@example.org"

  Scenario: Without vehicles the dashboard says so
    When I open the app
    Then I see the text "Noch keine Fahrzeuge erfasst."

  Scenario: Adding a vehicle opens it and lists it on the dashboard
    Given I open the app
    When I click "Bike hinzufügen"
    And I fill in "Name *" with "Africa Twin"
    And I select "Motorrad" in "Fahrzeugtyp *"
    And I fill in "Baujahr" with "2021"
    And I fill in "Kilometerstand (km)" with "12500"
    And I fill in "Erstzulassung *" with "2021-04-15"
    And I click "Fahrzeug anlegen"
    Then the dialog is closed
    And I am on the page of the vehicle "Africa Twin"
    And I see the heading "Africa Twin"
    When I click "Zum Dashboard"
    Then the dashboard card of "Africa Twin" shows "12.500 km"
    And the dashboard card of "Africa Twin" shows "Noch keine Wartung erfasst"

  Scenario: A vehicle needs a name
    Given I open the app
    When I click "Bike hinzufügen"
    And I click "Fahrzeug anlegen"
    Then I see the text "Name ist erforderlich."

  Scenario: Due maintenance is shown on the dashboard
    Given a motorcycle "Tenere" with 19600 km exists
    And the vehicle "Tenere" has the task "Ölwechsel" every 10000 km, last done at 10000 km on "2026-03-01"
    When I open the app
    Then the dashboard card of "Tenere" shows "Ölwechsel"
    And the dashboard card of "Tenere" shows "Fällig in 400 km"

  Scenario: Opening a vehicle from the dashboard
    Given a motorcycle "Tenere" with 19600 km exists
    And I open the app
    When I open the vehicle "Tenere"
    Then I see the heading "Tenere"
    And I see the text "Noch keine Wartungsaufgaben hinterlegt."
