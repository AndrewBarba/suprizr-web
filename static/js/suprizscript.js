/********** SUPRIZR JAVASCRIPT SDK **********/
/********************************************/
/********************************************/

(function(){

    var $_sp_loaded = false; // did the sdk finish loading and grab the user object?
    var $_callbacks = []; // holds callbacks in memory to be called once sdk is loaded
    
    /**
     * Call this function with a callback to be notified when the sdk is loaded
     * callback is passed the current logged in user or false
     */
    SP = function(callback) {
        if ($_sp_loaded) {
            if (callback) callback($SP_USER);
        } else {
            if (callback) $_callbacks.push(callback);
        }
    }

    /********** GLOBALS **********/
    /*****************************/

    var $SP_HOST       = window.location.host;
    var $INTERNAL      = false; // internal uses localhost:8888 and is verbose
    var $LOCAL_API     = false; // this tells happyscript to use localhost:8888 as the api server
    var $SP_AUTH       = false; // suprizr auth token
    var $FB_AUTH       = false; // facebook auth token
    var $SP_USER       = false; // current logged in user
    var $SP_CLIENT_KEY = false; // clients public key
    var $SP_AUTO_LOAD  = true;  // auto load user data

    /********* INITIALIZATION *********/
    /**********************************/

    /**
     * Implementers should call this function before making any API requests to set their client token
     * Also sets the environment.
     * Sample input:
     * {
     *   production : true,
     *   public_key : "AAAA-BBBB-YYYY-ZZZZ"
     * }
     */
    SP.init = function(settings) {
        if (settings) {
            var prod = settings["production"];
            if (prod) {
                $INTERNAL = false;
            } else {
                $INTERNAL = true;
            }

            var local = settings["local"];
            if (local) {
                $LOCAL_API = true;
            }

            var key = settings["public_key"];
            if (typeof key == "string") {
                $SP_CLIENT_KEY = key;
            }

            var disable_auto_load = settings["disable_auto_load"];
            if (disable_auto_load) {
                $SP_AUTO_LOAD = false;
            }
        }
    }

    /**
     * Loads all the important pieces of the sdk. Pulls in things from the cache like friends list,
     * collections etc or fetches them if they dont exist.
     * Grabs auth tokens from cookies and a user object from local storage
     */
    SP.load = function(callback) {
        
        // load optional user settings
        if (window.spInit) window.spInit();

        // setup storage api, clear storage if outdated version
        SP.cookie.init();
        SP.storage.init();
        
        // setup global auth variables
        $SP_AUTH = SP.cookie.get("sp_auth");
        $FB_AUTH = SP.cookie.get("sp_fb_auth");
        $SP_USER = SP.storage.get("sp_user");

        // Load some things early
        SP.client.init();
        SP.api.init();
        SP.track.init();
        
        if ($SP_AUTO_LOAD) {
            SP.user.init();
        }

        // Facebook setup
        window.fbAsyncInit = function(){ SP.facebook.init(); };

        // fetch logged in user if needed
        if (SP.auth.hasAuth() && !$SP_USER) {
            trace("Auto loading user");
            SP.user.fetchCurrent(callback);
        } else {
            if (callback) callback($SP_USER);
            if (SP.auth.hasAuth()) SP.user.fetchCurrent(); // always fetch the latest copy of the user object
        }
    }

    /********* API SERVICE *********/
    SP.api = function(){}
    var $_api_ok = true;
    var $_api_refresh_interval = 60;
    /*******************************/

    /**
     * Checks the API at a set interval
     */
    SP.api.init = function() {
        SP.api.status(function(){
            setTimeout(SP.api.init,$_api_refresh_interval*1000);
        });
    }

    SP.api.status = function(callback) {
        SP.client.GET("/status",false,function(err, data){
            var ok = (!err) && (data.status == "OK");
            $_api_ok = ok;
            SP.event.post("SP.api.status.updated",ok);
            if (callback) callback(null, ok);
        });
        return $_api_ok;
    }

    SP.api.setRefreshInterval = function(seconds) {
        $_api_refresh_interval = seconds;
    }

    /********* LOCALSTORAGE SERVICE *********/
    SP.storage = function(){}
    var $_STORAGE_ENABLED = true;
    var $_STORAGE_VERSION = "1.0"; // increase this number to clear storage next time user visits the site
    /****************************************/

    /**
     * Sets up local storage. Clears storage if needed
     */
    SP.storage.init = function() {
        if (SP.storage.get("version") != $_STORAGE_VERSION) {
            SP.storage.clear();
        }
        if (SP.storage.get("version",true) != $_STORAGE_VERSION) {
            SP.storage.clear(true);
        }
    }

    /**
     * Grabs an item from localstorage (or session storage is you pass true as the last argument)
     * automatically checks for expiration
     */
    SP.storage.get = function(key,session) {
        if (!$_STORAGE_ENABLED) return false;
        
        var string = false;
        if (session) {
            string = sessionStorage.getItem(key);
        } else {
            string = localStorage.getItem(key);
        }

        if (string) {
            var data = JSON.parse(string);
            var exp = data["expires"];
            var now = (new Date()).getTime() / 1000;
            if (exp > 0 && now >= exp) {
                SP.storage.remove(key,session);
                return false;
            } else {
                return data.data;
            }
        } else {
            return false;
        }
    }

    /**
     * Sets a key value pair in localstorage (or session storage if last param is true)
     * expire is by diarydate in days. SP.storage.set("name","andrew",5) will expire in 5 days at 4am on the 5th day
     * SP.storage.set("name","andrew",1) will expire tomorrow at 4am
     */
    SP.storage.set = function(key,obj,expires,session) {
        if (!$_STORAGE_ENABLED) return;
        var data = {"data":obj,"expires":0};
        if (expires) {
            var date = SP.date.diaryDate(expires);
            data["expires"] = date.getTime() / 1000;
        }
        try {
            if (session) {
                sessionStorage.setItem(key,JSON.stringify(data));
            } else {
                localStorage.setItem(key,JSON.stringify(data))
            }
        } catch(e) {
            return false;
        }
    }

    /**
     * Removes an item from local or session storage
     */
    SP.storage.remove = function(key,session) {
        if (!$_STORAGE_ENABLED) return;
        try {
            if (session) {
                if (!key) {
                    sessionStorage.clear();
                } else {
                    sessionStorage.removeItem(key);
                }
            } else {
                if (!key) {
                    localStorage.clear();
                } else {
                    localStorage.removeItem(key);
                }
            }
        } catch(e) {
            return false;
        }
    }

    /**
     * Clears all storage
     */
    SP.storage.clear = function(session) {
        if (!$_STORAGE_ENABLED) return;
        if (session) {
            SP.storage.remove(false,true);
            SP.storage.set("version",$_STORAGE_VERSION,0,true);
        } else {
            SP.storage.remove();
            SP.storage.set("version",$_STORAGE_VERSION);
        }
    }

    SP.storage.disable = function() {
        $_STORAGE_ENABLED = false;
    }

    /********* COOKIE SERVICE *********/
    SP.cookie = function(){ // return all cookie keys in an array
        var arr = document.cookie.split("; ");
        var keys = [];
        SP.each(arr,function(i,s){
            var k = s.split("=");
            keys.push(k[0]);
        });
        return keys;
    }
    var $_COOKIE_ENABLED = true;
    var $_COOKIE_VERSION = "1.0"; // increase this number to clear all cookies next time user visits the page
    /**********************************/

    /**
     * Sets up cookies and clear them is necessary
     */
    SP.cookie.init = function() {
        var version = SP.cookie.get("sp_version");
        if (version != $_COOKIE_VERSION) {
            SP.auth.clear();
            SP.cookie.set("sp_version",$_COOKIE_VERSION,999);
        }
    }

    /**
     * retrieve a cookie with given key
     */
    SP.cookie.get = function(key) {
        if (!$_COOKIE_ENABLED) return;
        var start = document.cookie.indexOf( key + "=" );
        var len = start + key.length + 1;
        if ((!start) && (key != document.cookie.substring(0,key.length))) {
            return false;
        }
        if ( start == -1 ) return false;
        var end = document.cookie.indexOf( ';', len );
        if ( end == -1 ) end = document.cookie.length;
        return unescape(document.cookie.substring(len,end));
    }

    /**
     * set a cookie and expire in x days
     */
    SP.cookie.set = function(key,string,expires) {
        if (!$_COOKIE_ENABLED) return;
        var secure = window.location.protocol == "https:";
        var path = "/";
        var domain = false;
        if (expires) expires = expires * 1000 * 60 * 60 * 24;
        var expires_date = new Date((new Date()).getTime() + (expires));
        document.cookie = key+'='+escape(string) +
            ((expires) ? ';expires='+expires_date.toGMTString() : '' ) + //expires.toGMTString()
            ((path) ? ';path=' + path : '' ) + 
            ((domain) ? ';domain=' + domain : '' ) +
            ((secure) ? ';secure' : '' );
    }

    /**
     * remove a cookie with the given key
     */
    SP.cookie.remove = function(key) {
        if (!$_COOKIE_ENABLED) return;
        if (SP.cookie.get(key)) {
            var path = "/";
            document.cookie = key + '=' +
                ((path) ? ';path=' + path : '') +
                ';expires=Thu, 01-Jan-1970 00:00:01 GMT';
        }
    }

    /**
     * clear all (available) cookies
     * note: cookies like _utm or _ga are not available to us
     */
    SP.cookie.clear = function() {
        if (!$_COOKIE_ENABLED) return;
        SP.each(SP.cookie(),function(i,k){
            if (k != "sp_version") SP.cookie.remove(k);
        });
    }

    SP.cookie.disable = function() {
        $_COOKIE_ENABLED = false;
        $SP_AUTH = false;
        $FB_AUTH = false;
        $SP_USER = false;
    }

    /******* USER SERVICE *******/
    SP.user = function(){ return $SP_USER; } // returns the current logged in user
    /****************************/

    /**
     * Load moment count from cache and then refetches to sync with server
     */
    SP.user.init = function() {
        if (SP.auth.hasAuth()) {
            // do stuff
        }
    }

    /**
     * Fetch the current user and automatically update our cached copy of the user
     * and any copies of the user in memory
     */
    SP.user.fetchCurrent = function(callback) {
        SP.client.GET("/user", {}, function(err, user){
            if (!err) {
                SP.user._update(user,callback);
            } else {
                if (callback) callback(err);
            }
        });
    }

    /**
     * Fetch a user by _id
     */
    SP.user.fetch = function(uid,callback) {
        SP.client.GET("/user/"+uid, {}, callback);
    }

    /**
     * Set user info for the current user
     */
    SP.user.setInfo = function(first,last,email,callback) {
        var data = {};
        if (first && first.length > 0) data["first_name"] = first;
        if (last && last.length > 0) data["last_name"] = last;
        if (email && email.length > 0) data["email"] = email;
        SP.user.putData(data,callback);
    }

    /**
     * Attach data to the current user object
     */
    SP.user.putData = function(data,callback) {
        if (data.length == 0) {
            if (callback) callback();
            return;
        }
        SP.client.PUT("/user/",data,function(err, user){
            if (!err) {
                SP.user._update(user, callback);
            } else {
                if (callback) callback(err);
            }
        });
    }

    /**
     * Cache the given user and update all user objects
     */
    SP.user._update = function(user,callback) {
        $SP_USER = user;
        SP.storage.set("sp_user",SP.user.simpleUser(user));
        if (callback) callback(null, user);
        SP.event.post("SP.user.updated",user);
    }

    /**
     * Return a user object with keys i actually care about
     * Theres a lot of junk on the user object i dont want
     */
    SP.user.simpleUser = function(user) {
        var keys = ["_id","first_name","last_name","email","created_at","gender","admin"];
        var u = {};
        SP.each(keys, function(index,key){
            var val = user[key];
            if (val) u[key] = val;
        });
        return u;
    }

    /****** AUTHENTICATION *******/
    /**
     * Adds auth to a user or 
     * returns a dictionary of current auth token
     */
    SP.auth = function(auth, user, callback){
        if (auth) {
            if (user) SP.auth.clear();
            $SP_AUTH = auth;
            SP.cookie.set("sp_auth",auth,999);
            SP.event.post("SP.auth.changed",auth);
            if ($SP_USER || user) {
                SP.user._update(user, callback);
            } else {
                if (callback) callback(null, $SP_USER);
            }
            return SP.auth();
        } else {
            var data = {};
            if ($SP_CLIENT_KEY) {
                data["sp_public_key"] = $SP_CLIENT_KEY;
            }
            if ($SP_AUTH) {
                data["auth"] = $SP_AUTH;
            }
            return data;
        }
    }
    /*****************************/

    /**
     * Does the current user have auth?
     */
    SP.auth.hasAuth = function() {
        return $SP_AUTH;
    }

    /**
     * Returns auth string that's useful for appending to urls
     */
    SP.auth.authString = function() {
        if (SP.auth.hasAuth()) {
            return "auth="+$SP_AUTH;
        }
        return "";
    }

    /**
     * Logs in a user via email and password. Automatically fetches the
     * new user object, clears all previous tokens and caches, and caches new data
     */
    SP.auth.login = function (email, password, callback) {
        var data = { "email":email, "password":password };
        SP.client.POST("/auth/login", data, function(err, data){
             if (!err) {
                 SP.track.event("Login - Email - Complete",SP.user.simpleUser(data.user));
                 var token = data.auth_token;
                 SP.auth(token, data.user, callback);
             } else {
                 SP.track.event("Login - Email - Failed");
                 if (callback) callback(err);
             }
        });
    }

    /**
     * Logs in a user via facebook auth token. Automatically fetches the
     * new user object, clears all previous tokens and caches, and caches new data
     */
    SP.auth.login.facebook = function (callback) {
        SP.facebook.login(function(fbtoken,response){
            if (fbtoken) {
                var data = { "facebook_auth_token" : fbtoken };
                SP.client.POST("/auth/facebook", data, function(err, data){
                     if (!err) {
                        SP.track.event("Login - Facebook - Complete",SP.user.simpleUser(data.user));
                        SP.facebook(fbtoken);
                        var token = data.auth_token;
                        SP.auth(token, data.user, callback);
                     } else {
                        if (callback) callback();
                     }
                });
            } else {
                if (callback) callback(err);
            }
        });
    }

    /**
     * Registers a new user via email and password as well as attaches optional facebook auth. 
     * Pass in a form reference to  upload a profile picture
     * Automatically fetches the new user object, clears all previous tokens and caches, and caches new data
     */
    SP.auth.register = function(data, callback) {
        SP.client.POST("/auth/register", data, function(err, data){
             if (!err) {
                 SP.track.event("Registration - Complete",SP.user.simpleUser(data.user));
                 var token = data.auth_token;
                 SP.auth(token, data.user, callback);
             } else {
                 SP.track.event("Registration - Failed");
                 if (callback) callback(err);
             }
        });
    }

    /**
     * Logs out the user from Suprizr and allows you to optionally redirect the user
     * Clears cache and all auth tokens
     */
    SP.auth.logout = function (redirect) {
        if (redirect) SP.track.event("Logout - Complete");
        SP.auth.clear();
        SP.redirect(redirect);
    }

    /**
     * Sends a reset password email to the given email address
     * TODO: Implement this on the server
     */
    SP.auth.resetPassword = function (email,callback) {
        SP.client.DELETE("/auth/password", {"email":email}, callback);
    }

    /**
     * Changes the current users password and updates their auth token
     */
    SP.auth.changePassword = function(to,from,callback) {
        var data = {"password":to, "old_password":from, "client":SP.guid() };
        SP.client.PUT("/auth/password",data,function(err, data){
            if (!err) {
                var token = data.auth_token;
                SP.auth(token, data.user, callback);
            } else {
                if (callback) callback(err);
            }
        });
    }

    /**
     * Clears all tokens and caches
     */
    SP.auth.clear = function() {
        SP.cookie.clear();
        SP.storage.clear();
        SP.storage.clear(true);
        $SP_AUTH = false;
        $FB_AUTH = false;
        $SP_USER = false;
        SP.event.post("SP.auth.changed",$SP_AUTH);
    }

    /************** RESTAURANT ************/
    SP.restaurant = function(){}
    /**************************************/

    SP.restaurant.fetchAll = function(callback) {
        SP.client.GET("/restaurant", {}, function(err, data){
            if (!err) {
                if (callback) callback(null, data.restaurants);
            } else {
                if (callback) callback(err);
            }
        });
    }

    SP.restaurant.fetch = function(id, callback) {
        SP.client.GET("/restaurant/"+id, {}, callback);
    }

    SP.restaurant.update = function(id, data, callback) {
        SP.client.PUT("/restaurant/"+id, data, callback);
    }

    SP.restaurant.create = function(data, callback) {
        SP.client.POST("/restaurant", data, callback);
    }

    SP.restaurant.delete = function(id, callback) {
        SP.client.DELETE("/restaurant/"+id, {}, callback);
    }

    /************** MEAL ************/
    SP.meal = function(){}
    /********************************/

    SP.meal.fetchForRestaurant = function(restaurant, callback) {
        SP.client.GET("/meal", {"restaurant":id}, function(err, data){
            if (!err) {
                if (callback) callback(null, data.meals);
            } else {
                if (callback) callback(err);
            }
        });
    }

    SP.meal.fetch = function(id, callback) {
        SP.client.GET("/meal/"+id, {}, callback);
    }

    SP.meal.update = function(id, data, callback) {
        SP.client.PUT("/meal/"+id, data, callback);
    }

    SP.meal.create = function(data, callback) {
        SP.client.POST("/meal", data, callback);
    }

    SP.meal.delete = function(id, callback) {
        SP.client.DELETE("/meal/"+id, {}, callback);
    }

    /******* FACEBOOK SDK *********/
    SP.facebook = function(token) { // ataches facebook auth to the current user in memeory, does not persist to server
        $FB_AUTH = token;
        SP.cookie.set("sp_fb_auth",token,999);
        SP.event.post("SP.facebook.updated",token);
    }
    var $_fb_loaded = false;
    var $_fb_callbacks = [];
    /******************************/

    /**
     * Automatically adds facebook functions to a queue to be called as soon
     * as the SDK is loaded. If the SDK is loaded when this function is called
     * then the callback is executed immediately
     */
    SP.facebook.api = function(callback) {
        if (callback) {
            if ($_fb_loaded) {
                if (defined("FB")) {
                    return callback();
                }
            } else {
                return $_fb_callbacks.push(callback);
            }
        }
        return false;
    }

    /**
     * Initializes the facebook sdk and sets up a listener for auth change notification
     * Automatically attaches facebook info (persists to server) if the current facebook user
     * is the current suprizr user. This ensures the server always has the most up to date fb_auth token
     */
    SP.facebook.init = function() {
        FB.init({
            appId      : "285543038247615", // App ID
            channelUrl : "//www.suprizr.com/static/facebook/channel.html", // Channel File
            status     : true, // check login status
            cookie     : true, // enable cookies to allow the server to access the session
            xfbml      : true, // parse XFBML
        });

        FB.Event.subscribe("auth.statusChange", function(response){
            SP.event.post("SP.facebook.loaded");
            if (response.status == "connected") {
                var token = response.authResponse.accessToken;
                if ($SP_USER && response.authResponse.userID == $SP_USER.facebook_id) {
                    trace("Connected to facebook");
                    SP.facebook(token);
                    SP.user.putData({"fb_auth":token});
                } else if (!$SP_USER) {
                    trace("Signed into facebook, logged out of suprizr");
                } else {
                    trace("Facebook user is not the same suprizr user");
                }
            } else {
                trace("not connected with facebook");
            }
        });
        $_fb_loaded = true;

        // Run all of the queued facebook calls
        SP.each($_fb_callbacks,function(i,c){
            if (c) c();
        });
    }

    /**
     * Grabs the current users facebook user object. 
     * They do not need suprizr auth or need to have a suprizr account for this to work
     */
    SP.facebook.user = function(callback) {
        if (!SP.facebook.auth()) {
            SP.facebook.login(function(token){
                if (token) {
                    getMe(callback);
                } else {
                    if (callback) callback();
                }
            },true);
        } else {
            getMe(callback);
        }
        function getMe(callback) {
            SP.facebook.api(function(){
                FB.api("/me",{fields:"id,link,first_name,last_name,name,picture.type(square),verified,email"},function(response){
                      if (callback) callback(response);
                });
            });
        }
    }

    /**
     * Grab the users facebook friends list
     */
    SP.facebook.friendList = function(callback) {
        SP.facebook.api(function(){
            FB.api('/me/friends', function(response) {
                if(response.data) {
                    if (callback) callback(response.data);
                } else {
                    if (callback) callback();
                }
            });
        });
    }

    /**
     * Returns the current facebook auth token
     */
    SP.facebook.auth = function() {
        return $FB_AUTH;
    }

    /**
     * Logs a user into facebook, NOT HAPPIER
     * this will get us a facebook auth token if successful
     * SP.auth.login.facebook to login a user to suprizr using facebook auth
     */
    SP.facebook.login = function(callback) {
        SP.facebook.api(function(){
            FB.login(function(response) {
                if (response.authResponse) {
                    var token = response.authResponse.accessToken;
                    if (callback) callback(token,response);
                } else {
                    if (callback) callback();
                }
            },{scope:"email"});
        });
    }

    /**
     * Log a user out of facebook
     * this will not log a user of of happeir
     */
    SP.facebook.logout = function() {
        SP.facebook.api(function(){
            FB.logout();
        });
    }

    /**
     * Connect the current Suprizr users account with their facebook account
     * Must have a logged in Suprizr user
     * Cannot connect to a previously connteced facebook account
     */
    SP.facebook.connect = function(callback) {
        SP.auth.login.facebook(callback);
    }

    /****** EVENT SERVICE *******/
    SP.event = function(){}
    var $_EVENTS = {};
    /*****************************/

    /**
     * Subscribe to an event to be notified everytime the event is fired
     * callback params depend on the event
     */
    SP.event.subscribe = function(event,callback) {
        if (callback) {
            if (!$_EVENTS[event]) $_EVENTS[event] = new Array();
            $_EVENTS[event].push(callback);
        }   
    }

    /**
     * Post an event to the given key. Pass the given object to all listeners
     */
    SP.event.post = function(event,obj) {
        var events = $_EVENTS[event];
        if (events) {
            SP.each(events,function(index,callback){
                if (callback) callback(obj);
            });
        }
    }

    /****** BACKEND CLIENT *******/
    SP.client = function(){}
    var $_use_xdr = false;
    /*****************************/

    /**
     * Determines whether the current browser is ie9
     * so we can use an XDomainRequest instead of XMLHttpRequest
     */
    SP.client.init = function() {
        if (!SP.client.cors() && window.XDomainRequest) {
            $_use_xdr = true;
        } else if (!SP.client.cors()) {
            SP.event.post("SP.client.unsupported"); // this user cannot use suprizr.com
        }
    }

    SP.client.cors = function() {
        return "withCredentials" in new XMLHttpRequest();
    }

    /**
     * Returns the suprizr api root
     * qa if we are not on suprizr.com
     * prod if the current host is suprizr.com
     */
    SP.client.host = function() {
        if ($INTERNAL) {
            return "//localhost:5000";
        } else {
            return "//api.suprizr.com";
        }
    }

    /**
     * Return a url with the given endpoint
     * automatically attaches auth if we have it
     * appends data to url as query string if supplied
     */
    SP.client.url = function (endpoint,data) {
        var base = SP.client.host();
        var url = base + endpoint;
        var urldata = SP.extend(SP.auth(),data);
        if (urldata) {
            url += (endpoint.indexOf("?") < 0) ? "?" : "&";
            url += SP.client.queryString(urldata);
        }
        return url;
    }

    /**
     * Converts a dictionary of keys and values into a valid query string
     * Ex: {"name":"andrew","sports":["baseball","basketball"]} = name=andrew&sports=baseball&sports=basketball
     */
    SP.client.queryString = function(obj) {
        var string = "";
        SP.each(obj,function(k,v){
            if (v) {
                if (typeof v === "object") {
                    SP.each(v,function(i,x){
                        string += k + "=" + encodeURIComponent(x) + "&";
                    });
                } else {
                    string += k + "=" + encodeURIComponent(v) + "&";
                }
            }
        });
        return string.slice(0,-1);
    }

    /**
     * Makes a request to a Suprizr endpoint
     * 10 second timeout on get requests, 30 second timeout on post requests
     * Uses jQuery's built in ajax method
     */
    SP.client.request = function (verb, endpoint, data, callback, upload) {   
        trace("SP.client: "+verb+" "+endpoint);
        // setup some variables
        var url = SP.client.url(endpoint, verb == "GET" ? data : false);
        var post = verb != "GET" ? data : null;
        var timeout = upload ? 30000 : 20000;
        if (verb != "GET" && $_use_xdr) verb = "POST";

        // build request object
        var request = $_use_xdr ? new XDomainRequest() : new XMLHttpRequest(); // XDomainRequest for ie9, XMLHttpRequest for everything else
        request.open(verb, url, true); // open up the request before setting any variables
        request.callback = callback; // hang on to our callback function
        request.timeout = timeout;
        request.start = new Date(); // set a start date so we can track how long the request took
        request.complete = false; // nope, not done yet
        request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");

        // Setup callbacks
        request.success = function() {
            var text = this.responseText;
            var obj = (text.length > 0) ? JSON.parse(this.responseText) : {}; // our api only returns JSON, lets parse it
            if (callback) this.callback.call(this, null, obj);
        };
        request.fail = function() {
            trace("SP.client ERROR: "+SP.client.url(endpoint)+" - "+this.statusText,true); // damn, something went wrong. tell me about it
            var text = this.responseText;
            var err = null;
            if (text.length) err = JSON.parse(this.responseText);
            if (!err) err = { error: "Server error", message: "Something went wrong" };
            if (this.callback) this.callback.call(this, err);
        };
        request.unauthorized = function() {
            if (SP.auth.hasAuth()) SP.event.post("SP.auth.unauthorized");
            this.fail();
        }
        request.serverError = function() {
            if (endpoint != "/status") {
                SP.api.status(); // check the api status if an endpoint failed to load
            }
            this.fail();
        }
        request.done = function() {
            this.complete = true; // wahoo! finished the request, track how long it took
            var time = SP.trackTime(this.start);
            if (time > 3.0 && !upload) trace(endpoint+" took "+time+" seconds",true); // I want to know about any request taking longer than 3 seconds. gotta keep @parker honest
        };

        // Handle response
        if ($_use_xdr) {
            // special XDomainRequest callbacks
            request.onerror = function() {
                this.done();
                this.fail();
            };
            request.ontimeout = function() {
                this.done();
                this.serverError();
            };
            request.onload = function() {
                this.done();
                this.success();
            };
            request.onprogress = function(){};
            setTimeout(function(){
                request.send(post);
            },50); // wait a beat to dispatch on main thread, ie9 chokes without this
        } else {
            // state change for XMLHttpRequest
            request.onreadystatechange = function() {
                if (this.readyState == 4) { // 4 means done, look it up in the docs if you don't believe me
                    this.done();
                    switch (this.status) {
                        case 200:
                            this.success();
                            break;
                        case 401:
                            this.unauthorized();
                            break;
                        case 500:
                            this.serverError();
                            break;
                        default:
                            this.fail();
                            break;
                    }
                }
            };
            request.send(post);
            setTimeout(function(){ // handle timeout since XMLHttpRequest doesn't...
                if (!request.complete) request.abort();
            },timeout);
        }

        return request;
    }

    /**
     * GET Request
     * useful for getting first class objects
     */
    SP.client.GET = function (endpoint, data, callback) {
        return SP.client.request("GET",endpoint,data,callback);
    }

    /**
     * POST Request
     * useful for creating a first class object
     */
    SP.client.POST = function (endpoint, data, callback) {
        return SP.client.request("POST",endpoint,JSON.stringify(data),callback);
    }

    /**
     * DELETE Request
     * useful for deleting first class objects
     */
    SP.client.DELETE = function (endpoint, data, callback) {
        return SP.client.request("DELETE",endpoint,JSON.stringify(data),callback);
    }

    /**
     * PUT Request
     * useful for adding/changing object data
     */
    SP.client.PUT = function (endpoint, data, callback) {
        return SP.client.request("PUT",endpoint,JSON.stringify(data),callback);
    }

    /**
     * Modified POST request
     * useful for uploading form data
     */
    SP.client.UPLOAD = function (endpoint, data, callback) {
        return SP.client.request("POST",endpoint,data,callback,true);
    }

    /**
     * Our suprizr cdn
     */
    SP.client.cdn = function() {
        return "//d3nazrtuuwdon4.cloudfront.net";
    }

    /************ SP TRACKING ***************/
    SP.track = function(name,obj){ SP.track.event(name,obj); }
    var $_trackingEnabled = false;
    /****************************************/

    SP.track.init = function() {
        $_trackingEnabled = true;
    }

    /**
     * Track an event on Mixpanel
     */
    SP.track.event = function(name,obj) {
        if ($_trackingEnabled && defined("mixpanel")) {
            trace("Tracking: "+name);
            if ($INTERNAL || !$SP_USER.is_staff) { // don't track staff users on prod
                mixpanel.track(name,obj);
            }
        }
    }

    /**
     * Register a given user in mixpanel
     */
    SP.track.register = function(user) {
        if ($_trackingEnabled && defined("mixpanel") && user) {
            mixpanel.identify(user._id);
            mixpanel.alias(user._id);
            mixpanel.name_tag(user.first_name+" "+user.last_name);
            var data = {
                "id"          :user._id,
                "$email"      :user.email,
                "$first_name" :user.first_name,
                "$last_name"  :user.last_name,
                "$created"    :new Date(user.created_at * 1000),
            };
            mixpanel.register(data);
            mixpanel.people.set(data);
        }
    }

    /********* HELPERS *********/
    /***************************/

    defined = function(x) { return (x in window); } // is something defined
    trace = function(t,f) { if (($INTERNAL || f) && defined("console")) console.log(t); } // log to console
    rtrace = function(err, data, force) { trace(data, force); } // traces request callbacks easily
    SP.equal = function(sp1,sp2) { return sp1 && sp2 && (sp1._id == sp2._id) && sp1._id; } // are two sp objects equal?
    SP.s4 = function(){return (((1+Math.random())*0x10000)|0).toString(16).substring(1); } // random 4 digit string/number
    SP.guid = function(){return(SP.s4()+SP.s4()+"-"+SP.s4()+"-4"+SP.s4().substr(0,3)+"-"+SP.s4()+"-"+SP.s4()+SP.s4()+SP.s4()).toLowerCase();} // guid generator
    SP.date = function(){return new Date();}; // returns a date
    SP.date.diaryDate = function(days) { // returns a diary diate. (A day that starts at 4am or the previous day)
        var today = SP.parseDiaryDate(SP.diaryDate());
        today.setHours(4);
        today.setDate(today.getDate()+days);
        return today;
    }
    SP.diaryDate = function(d){ // produces a human readable diary date string, not a date object
        var date = d ? d : new Date();
        var y = date.getFullYear();
        var m = (date.getMonth()+1);
        var m = m < 10 ? "0"+m : m+""; 
        var d = date.getDate();
        d = d < 10 ? "0"+d : d+"";
        return y + "-" +  m + "-" + d;
    }
    SP.redirect = function(path) { // redirect the page or # to reload the current. adds timeout to give cookie time to store. we do this a lot
        if (path) {
            setTimeout(function(){
                if (path == "#") {
                    location.reload();
                } else {
                    window.location = path;
                }
            },100);
        }
    }
    SP.dateString = function(date) { // returns a nicely formatted date string
        return (date.getMonth()+1) + "." + date.getDate() + "." + date.getFullYear();
    }
    SP.prettyDateString = function() {
        // nothing for now
    }
    SP.relativeTime = function(date) { // returns a string that nicely portrays relative time since a given date
        var now = new Date();
        var nowSeconds = now.getTime() / 1000;
        var dateSeconds = date.getTime() / 1000;
        var diff = Math.ceil(nowSeconds - dateSeconds);
        var tense;
        if (diff < 60) {
            return "just now";
        } else if (diff < 60*60) {
            tense = "minute";
            diff = Math.floor(diff/60);
        } else if (diff < 60*60*24) {
            tense = "hour";
            diff = Math.floor(diff/60/60);
        } else if (diff < 60*60*24*7) {
            tense = "day";
            diff = Math.floor(diff/60/60/24);
            if (diff == 1) return "yesterday";
            if (diff < 7) return SP.dayOfWeek(date);
        } else {
            return SP.dateString(date);
        }
        if (diff != 1) tense += "s";
        return diff + " " + tense + " ago";
    }
    SP.dayOfWeek = function(date) { // returns the english day of week for the given date
        switch(date.getDay()) {
            case 0: return "Sunday";
            case 1: return "Monday";
            case 2: return "Tuesday";
            case 3: return "Wednesday";
            case 4: return "Thursday";
            case 5: return "Friday";
            case 6: return "Saturday";
        }
        return "";
    }
    SP.monthString = function(date) { // returns the english month for the given date
        switch(date.getMonth()) {
            case 0: return "January";
            case 1: return "February";
            case 2: return "March";
            case 3: return "April";
            case 4: return "May";
            case 5: return "June";
            case 6: return "July";
            case 7: return "August";
            case 8: return "September";
            case 9: return "October";
            case 10: return "November";
            case 11: return "December";
        }
        return "";
    }
    SP.parseDiaryDate = function(d) { // parses a date in the format YYYY-MM-DD ex: 2013-05-01
        if (d && d != "") {
            var parts = d.match(/(\d+)/g);
            return new Date(parts[0], parts[1]-1, parts[2]);
        } else {
            return false;
        }
    }
    SP.parseDateInputString = function(s) { // this function parses dates in the format "2013-06-11T01:00"
        var date = false;
        var parts = s.split("T");
        if (parts.length > 0) {
            date = SP.parseDiaryDate(parts[0]);
        }
        if (date && parts.length > 1) {
            var time = parts[1].split(":");
            date.setHours(time[0]);
            date.setMinutes(time[1]);
        }
        return date;
    }
    SP.dateToInputDateString = function(date) {
        var s = SP.diaryDate(date) + "T";
        
        var hours = date.getHours();
        if (hours < 10) hours = "0" + hours;
        s += hours + ":";
        
        var min = date.getMinutes();
        if (min < 10) min = "0" + min;
        s += min;

        return s;
    }
    SP.secondsToFullDateString = function(d) {
        var date = new Date(d*1000);
        var s = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear()

        var h = date.getHours();
        var a = h > 12 ? "pm" : "am";
        if (h > 12) h -= 12;
        if (h == 0) h = 12;

        var m = date.getMinutes();
        if (m < 10) m = "0" + m;
        return s + " " + h + ":" + m + a;
    }
    SP.isEmail = function(email) { // is the given string a valid email address
        var filter = /^([a-zA-Z0-9_\.\-\+])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
        return filter.test(email);
    }
    SP.isIE9 = function(){return navigator.userAgent.indexOf("MSIE") != -1;} // is the current browser ie9?
    SP.randomElement = function(array) { // grab a random element from an array
        return array[Math.floor(Math.random()*array.length)];
    }
    SP.isMobile = function() { // is the current browser a mobile device (at least a popular mobile device)
        return (/iphone|ipod|ipad|android|blackberry|fennec/).test(navigator.userAgent.toLowerCase());
    }
    SP.isiOS = function() {
        return (/iphone|ipod|ipad/).test(navigator.userAgent.toLowerCase());
    }
    SP.isAndroid = function() {
        return (/android/).test(navigator.userAgent.toLowerCase());
    }
    SP.trackTime = function(date) { // prints/returns time difference (seconds) between now and a given date
        var seconds = ((new Date()).getTime()/1000) - (date.getTime()/1000);
        return seconds;
    }
    SP.each = function(arr,fnc) { // a simple for-each implementation
        for (var k in arr) {
            var obj = arr[k];
            fnc.call(obj,k,obj);
        }
    }
    SP.extend = function(a,b,f) { // combines second dict into first dict and returns it. if third param is true, b keys overright a keys
        if (a) {
            SP.each(b,function(k,v){
                if (v && (!a[k] || f)) a[k] = v;
            });
            return a;
        } else {
            return b;
        }
    }
    SP.grep = function(arr,fnc) { // filters an array according to a given function
        var newarr = [];
        SP.each(arr,function(k,v){
            var pass = fnc.call(v,v,k);
            if (pass) newarr.push(v);
        });
        return newarr;
    }

    /************ SDK LOADED ************/
    /************************************/
    
    /**
     * Okay, everything is defined, start loading data
     * Once loaded, call all callbacks that were passed to SP()
     */
    SP.load(function(user){
        $_sp_loaded = true;
        SP.track.register(user);
        SP.each($_callbacks,function(index,callback){
            if (callback) callback(user);
        });
    });

})();