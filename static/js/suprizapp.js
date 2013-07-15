$(function(){
    setTimeout(function(){
        SP.history.init();
    });
});

(function(){
    
    /**
     * A funciton used to be notified when a certain rout is displayed
     * SP.history("/hello", callback) will call the callbacl when /hello appears
     * SP.history("/hello/*", callback) will call the callback when /hello/{anythingHere} appears
     */
    $_history = {};
    var $_historyStack = [];

    SP.history = function(path, callback)
    {
        if (callback) {
            if (!$_history[path]) $_history[path] = [];
            $_history[path].push(callback);
        }
    }
    
    /**
     * Updates history by calling all callbacks and hiding/showing data appropritate for the given url
     */
    SP.history.updateHistory = function(path, post) {
        if (!path) path = SP.history.urlPath();

        $(".history").hide();

        function triggerKey(key, val) {
            var css_sel = key.replace(/\//g,"-"); // cant have slashes in css selector sadly :(
            var css_sel = css_sel.replace(/\*/g,"0"); // cant have * in css selector sadly :(
            $("."+css_sel).show();
            var callbacks = $_history[key];
            if (callbacks) {
                SP.each(callbacks, function(i, callback){
                    if (callback) callback(val, post);
                });
            }
        }

        // show proper divs
        path = SP.removeLastChar(path, "/");
        triggerKey(path);
        var parts = path.split("/");
        SP.each(parts, function(i, part){
            if (part && part.length) {
                var copy = parts.slice(0);
                copy[i] = "*";
                var key = copy.join("/");
                var css_sel = copy.join("-");
                triggerKey(key, part);
            }
        });

        SP.history.dealloc();
    }

    SP.history.dealloc = function() {
        // dealloc old divs and values
        var old = $(".dealloc");
        old.html("");
        old.val(""); 
    }

    var $_shouldPop = false;
    SP.history.init = function()
    {
        $_historyStack.push(window.location.pathname);

        if (SP.history.hasPushState()) {
            $(window).bind("popstate",function(event){
                if ($_shouldPop) {
                    $_historyStack.pop();
                    SP.history.render();
                }
            });
        } else {
            $(window).bind("hashchange",function(event){
                if ($_shouldPop) {
                    $_historyStack.pop();
                    SP.history.render();
                }
            });
        }

        SP.history.render();
        SP.history.track();
    }

    /**
     * Returns the full url path without query data
     */
    SP.history.urlPath = function()
    {
        var path;
        if (window.location.hash.length > 0) {
            path = window.location.hash;
        } else {
            path = window.location.pathname;
        }
        path =  SP.removeLastChar(path, "/"); // remove ending slash
        return path;
    }

    /**
     * Returns a url query param
     */
    SP.history.urlParam = function(param) {
        var dict = {};
        var s = window.location.search.slice(1);
        if (s.length) {
            var d = s.split("&");
            SP.each(d,function(i,item){
                var a = item.split("=");
                if (a.length > 1) {
                    dict[a[0]] = decodeURIComponent(a[1]);
                }
            });
            return dict[param];
        }
        return false;
    }

    /**
     * Splits the urlpath into an array of parts
     */
    SP.history.urlData = function()
    {
        var path = SP.history.urlPath();
        var data = path.split("/").slice(1);
        $.each(data,function(i,s){
            data[i] = SP.history.urlDecode(s);
        });
        return data;
    }

    SP.history.hasPushState = function()
    {
        if ("history" in window) {
            return "pushState" in history;
        }
        return false;
    }

    SP.history.loadPath = function(path,post)
    {
        SP.history.setLastScrollTop();
        if (path != SP.history.urlPath()) {
            $_historyStack.push(path);
            if (SP.history.hasPushState()) {
                history.pushState({},null,path);
            } else {
                window.location = "/#"+path;
            }
            $_shouldPop = true;
            SP.history.render();
            SP.history.track();
        } else {
            SP.ui.scrollToTop();
        }
    }

    $_pageScrollTops = {};
    SP.history.lastScrollTop = function(path)
    {
        if (!path) path = SP.history.urlPath();
        return $_pageScrollTops[path] ? $_pageScrollTops[path] : 0;
    }

    SP.history.setLastScrollTop = function(path,scrollTop)
    {
        if (!path) path = SP.history.urlPath();
        if (!scrollTop) scrollTop = $(window).scrollTop();
        $_pageScrollTops[path] = scrollTop;
    }

    SP.history.render = function(forcePage,post)
    {
        if (forcePage) return;

        // Set page title
        var title = "Suprizr";
        document.title = title;

        SP.history.updateHistory();

        $(window).scrollTop(SP.history.lastScrollTop());
    }

    SP.history.urlEncode = function(string)
    {
        string = encodeURIComponent(string);
        string = string.replace(/_/g,"%5f");
        string = string.replace(/%20/g,"_");
        return string;
    }

    SP.history.urlDecode = function(string)
    {
        string = string.replace(/_/g,"%20");
        string = decodeURIComponent(string);
        return string;
    }

    SP.history.track = function() {
        // send google analytics
        if (window.location.host == "www.happier.com") {
            var path = SP.history.urlPath().replace("/#","");
            var data = {
                'hitType' : 'pageview',
                'page' : path,
                'title' : document.title
            };
            if (defined("ga")) {
                ga('send',data);
            }
            if (defined("_gaq")) {
                _gaq.push(['_trackPageview', path]);
            }
        }
    }
})();

(function(){

    SP.ui = function(){}

    SP.ui.scrollToTop = function() {
        $("html").animate({scrollTop: 0}, 300);
        $("body").animate({scrollTop: 0}, 300);
    }

    var _staticTmp = {};
    SP.ui.template = function(name,data)
    {
        if (!data) data = {};
        data["cdn"] = SP.client.cdn();
        data["api"] = SP.client.host();
        var tmp = _staticTmp[name];
        if (!tmp) {
            var src = $("#template-"+name).html();
            if (src && src.length > 0) {
                tmp = Handlebars.compile(src);
                _staticTmp[name] = tmp;
            }
        }
        var html = tmp ? tmp(data) : "";
        return html;
    }

})();

$(function(){

    /**
     * Automatically detects touch/tap vs click on desktop. Supports delegation in last argument
     */
    jQuery.fn.touchClick = function(fnc,sel)
    {
        if (SP.isiOS()) {
            var moved = false;
            var didmove = function(e) { moved = true; };
            var touchended = function(e) {
                e.stopPropagation();
                e.preventDefault();
                if (moved) {
                    moved = false;
                    return false;
                } else {
                    return fnc.call(this,e);
                }
            };
            var touchstart = function(e) {
                $("input,textarea").blur();
            };
            if (sel) {
                $(this).on("touchend",sel,touchended);
            } else {
                $(this).on("touchend",touchended);
            }
            if (sel) {
                $(this).on("touchmove",sel,didmove);
            } else {
                $(this).on("touchmove",didmove);
            }
            if (sel) {
                $(this).on("touchstart",sel,touchstart);
            } else {
                $(this).on("touchstart",touchstart);
            }
        } else {
            if (sel) {
                $(this).on("click",sel,fnc);
            } else {
                $(this).on("click",fnc);
            }
        }
    }

    /**
     * Loads a path in the web app when any class .link is tapped/clicked
     */
    $("body").touchClick(function(){
        var path = $(this).data("path");
        if (path) SP.history.loadPath(path);
    },".link");

    /**
     * Fires an event when tapped/clicked
     */
    $("body").touchClick(function(){
        var event = $(this).data("event");
        if (event) SP.event.post(event);
    },".event");

});