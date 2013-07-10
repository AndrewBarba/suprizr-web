Suprizr Web App
==========

This is the Suprizr HTML5 Web App built with:
* Flask - a Python server
* SuprizScript - a custom Suprizr Javascript SDK

We use a custom CSS and Jquery Framework to easily create web app behavior. The framework is designed to allow the url to change without ever reloading the page. It acts as a native app. The framework is called SP.history and could be used in the following ways:

#### Be notified when a page appears

	HP.history("/admin", function(){
		// www.suprizr.com/admin just appeared
	});

	HP.history("/meal/*", function(id){
		// the meal page just appeared and we are passed the id (the param in place of the *)
	});

	HP.history("/meal/*/edit", function(id){
		// the edit-meal page just appeared and we are passed the id (the param in place of the *)
	});

#### Load a new page

	// This will load the meal page meal id 1234
	// By load, I mean it will call the above function. Please refer below to see how display works
	HP.history.loadPath("/meal/1234");

#### Dynamic layout

	<div>

		<div class="history -admin"> I only show on the /admin page </div>

		<div class="history -admin-0"> I show on the /admin/* pages. I DON'T show on the /admin page </div>

		<div class="history -admin-0 -admin"> I show on both pages </div>

		<div class="history -meal-0-edit"> I show on the /meal/*/edit pages. </div>

	</div>

#### Load pages via click or tap

	<div>

		<div class="link" data-path="/admin"> Click me to go to the Admin page </div>

	</div>
