Feature: Switching the UI language
  The UI is German or English; a logged-in user's choice is saved in the account.

  Scenario: Switching the login page to English
    Given the app runs in portal mode
    And I open the app
    When I switch the language to "en"
    Then I see the heading "Log in"
    And I see a button "Log in"

  Scenario: A logged-in user's language is saved in the account
    Given the app runs in portal mode
    And I am logged in as "rider@example.org"
    And I open the app
    When I switch the language to "en"
    Then I see the text "Overview of all vehicles and due maintenance."
    And the account language was saved as "en"
    When I reload the page
    Then I see the text "Overview of all vehicles and due maintenance."
