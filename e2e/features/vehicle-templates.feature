Feature: Maintenance plan from a vehicle template

  Background:
    Given the app runs in portal mode
    And a vehicle template for "Moto Guzzi" "V7" exists with the tasks:
      | Ölwechsel     | 10000 |
      | Ventilspiel   | 20000 |
      | Kette fetten  | 1000  |

  Scenario: Creating a vehicle offers the template and applies the chosen tasks
    Given I am logged in as "rider@example.org"
    And I open the app
    When I click "Bike hinzufügen"
    And I fill in "Name *" with "Guzzi"
    And I fill in "Hersteller" with "Moto Guzzi"
    And I fill in "Modell" with "V7"
    Then I see the text "Für dieses Modell gibt es einen Wartungsplan"
    When I click "Fahrzeug anlegen"
    Then I see the heading "Wartungsplan aus Vorlage"
    When I click the button containing "Moto Guzzi V7"
    And I check "Ich habe den Hinweis gelesen."
    And I click "Übernehmen"
    Then the dialog is closed
    When I open the tab "Wartungsaufgaben"
    Then I see the text "Ölwechsel"
    And I see the text "Ventilspiel"
    And I see the text "3 übernommen, 0 schon vorhanden"

  Scenario: Creating a vehicle without a matching template just creates it
    Given I am logged in as "rider@example.org"
    And I open the app
    When I click "Bike hinzufügen"
    And I fill in "Name *" with "Africa Twin"
    And I fill in "Hersteller" with "Honda"
    And I fill in "Modell" with "CRF1100"
    Then I do not see the text "Für dieses Modell gibt es einen Wartungsplan"
    When I click "Fahrzeug anlegen"
    Then the dialog is closed
    And I am on the page of the vehicle "Africa Twin"
    And I do not see the text "Wartungsplan aus Vorlage"

  Scenario: Applying a template to an existing vehicle and again shows what is already present
    Given I am logged in as "rider@example.org"
    And a motorcycle "Tenere" with 19600 km exists
    And I open the app
    And I open the vehicle "Tenere"
    When I open the tab "Wartungsaufgaben"
    And I click "Vorlage übernehmen"
    And I fill in "Hersteller" with "Guzzi"
    And I click "Suchen"
    And I click the button containing "Moto Guzzi V7"
    And I check "Ich habe den Hinweis gelesen."
    And I click "Übernehmen"
    Then I see the text "3 übernommen, 0 schon vorhanden"
    When I click "Vorlage übernehmen"
    And I fill in "Hersteller" with "Guzzi"
    And I click "Suchen"
    And I click the button containing "Moto Guzzi V7"
    Then the dialog shows "schon vorhanden"
    And the button "Übernehmen" is disabled

  Scenario: Without access the plan cannot be extended from a template
    Given I am logged in as "rider@example.org" with expired access
    And a motorcycle "Tenere" with 19600 km exists
    And I open the app
    And I open the vehicle "Tenere"
    When I open the tab "Wartungsaufgaben"
    Then I do not see a button "Vorlage übernehmen"
