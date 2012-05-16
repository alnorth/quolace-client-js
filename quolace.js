/**
 * @license
 * Quolace v0.1 - By Alasdair North
 * http://quolace.appspot.com
 * 
 * Copyright © 2012, Alasdair North
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Alasdair North nor the
 *       names of other contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ALASDAIR NORTH OR OTHER CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 */

/*jslint devel: true, browser: true, sloppy: true, white: true, maxerr: 50, indent: 4, vars: true, sub: true */
/*global jQuery */

/**
 * Constructor for the Quolace object.
 * @constructor
 */
window["Quolace"] = function Quolace(appId, options) {
    var $ = jQuery;

    /** 
     * URL base for contacting the API. Should end in a forward slash.
     * @const
     * @type {string}
     */
    var urlRoot = "https://quolace.appspot.com/";

    /** 
     * Maximum length (in characters) of a key.
     * @const
     * @type {number}
     */
    var maxKeyLength = 500;

    /** 
     * Maximum length (in characters) of a value.
     * @const
     * @type {number}
     */
    var maxValueLength = 10000;

    /** 
     * @const
     * @type {string}
     */
    var tokenStorageKey = "quolace_token_" + appId;

    /** 
     * @const
     * @type {string}
     */
    var initialUrlStorageKey = "quolace_initial_url_" + appId;

    /** 
     * @const
     * @type {string}
     */
    var userDeclinedStorageKey = "quolace_declined_" + appId;

    /** 
     * @type {string}
     */
    var token = localStorage.getItem(tokenStorageKey);

    options = options || {};

    /** 
     * @type {boolean}
     */
    var useLocalStorage = options["alwaysUseLocalStorage"] || localStorage.getItem(userDeclinedStorageKey) === "true";
    
    function redirectToLogin() {
        localStorage.setItem(initialUrlStorageKey, document.location.href);
        document.location = urlRoot + "app/link?" + $.param({"id": appId, "return_url": document.location.href});
    }
    
    // From http://stackoverflow.com/a/5158301/152347
    function getParameterByName(name) {
        var match = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
        return match && decodeURIComponent(match[1].replace(/\+/g, " "));
    }

    function getErrorHandler(fn) {
        /*jslint unparam: true*/
        return function(jqXHR, textStatus, errorThrown) {
            console.error("Error in API call - ", textStatus, errorThrown);
            if(fn) { fn(false); }
        };
        /*jslint unparam: false*/
    }

    function buildUrl(appId, key, token) {
        var url = urlRoot + "api/1/apps/" + encodeURIComponent(appId) + "/values";
        if(key) {
            url += "/" + encodeURIComponent(key);
        }
        return url + "?" + $.param({"token": token});
    }

    function resetUrl() {
        history.replaceState({}, "", localStorage.getItem(initialUrlStorageKey));
        localStorage.removeItem(initialUrlStorageKey);
    }
    
    function init(fn) {
        if(useLocalStorage) {
            // No need to go to the API if we know we'll be using localStorage.
            if(fn) { fn(false); }
        } else if(getParameterByName("success") === "false") {
            console.log("User declined link, falling back to localStorage");
            useLocalStorage = true;
            localStorage.setItem(userDeclinedStorageKey, "true");
            resetUrl();
            if(fn) { fn(false); }
        } else {
            if(getParameterByName("success") === "true") {
                var auth_grant = getParameterByName("auth_grant"),
                    upgradeUrl = urlRoot + "api/1/upgrade?callback=?&" + $.param({"id": appId, "auth_grant": auth_grant});

                $.ajax({
                    url: upgradeUrl,
                    dataType: "json",
                    success: function(data) {
                        if(data.success) {
                            token = data["token"];
                            localStorage.setItem(tokenStorageKey, token);
                            resetUrl();
                            fn(true);
                        } else {
                            if(data["message"]) {
                                console.error("Error in API request - " + data["message"]);
                            }
                            if(fn) { fn(false); }
                        }
                    },
                    error: getErrorHandler(fn)
                });
                
            } else if(token) {
                localStorage.removeItem(initialUrlStorageKey);
                if(fn) { fn(true); }
            } else {
                redirectToLogin();
            }
        }
    }
    this["init"] = init;
    
    function set(key, value, fn) {
        if(typeof(key) !== "string") {
            if(fn) { fn(false); }
            console.error("Key is not a string - ", key);
        } else if(typeof(value) !== "string" && value !== null) {
            if(fn) { fn(false); }
            console.error("Value is not a string - ", value);
        } else {
            if(key.length > maxKeyLength) {
                if(fn) { fn(false); }
                console.error("Key is " + key.length + " characters long, the maximum key length is " + maxKeyLength + " - ", key);
            } else if (value !== null && value.length > maxValueLength) {
                if(fn) { fn(false); }
                console.error("Value is " + value.length + " characters long, the maximum value length is " + maxValueLength + " - ", value);
            } else {
                if(useLocalStorage) {
                    if(value && value !== "") {
                        localStorage.setItem(key, value);
                    } else {
                        localStorage.removeItem(key, value);
                    }
                    if(fn) { fn(true); }
                } else {
                    var url = buildUrl(appId, key, token);
                    $.ajax({
                        type: "POST",
                        url: url,
                        data: {"value": value || ""},
                        success: function(data) {
                            if(!data["success"] && data["message"]) {
                                console.error("Error in API request - " + data["message"]);
                            }
                            if(fn) { fn(data["success"]); }
                        },
                        dataType: "json",
                        error: getErrorHandler(fn)
                    });
                }
            }
        }
    }
    this["set"] = set;

    function setObject(key, value, fn) {
        this.set(key, value === null ? "" : JSON.stringify(value), fn);
    }
    this["setObject"] = setObject;

    function get(keyOrKeys, fn) {
        var url = "";
        if(typeof(keyOrKeys) === "string") {
            // This is a single key.
            if(useLocalStorage) {
                if(fn) {
                    fn(true, localStorage.getItem(keyOrKeys));
                }
            } else {
                url = buildUrl(appId, keyOrKeys, token);
            }
        } else {
            // This could be an array of strings (a valid input) or something else entirely. Let's check.
            var isArray = true,
                i = 0;
            if(Object.prototype.toString.call(keyOrKeys) === "[object Array]") {
                for(i = 0; i < keyOrKeys.length; i += 1) {
                    if(typeof(keyOrKeys[i]) !== "string") {
                        isArray = false;
                        break;
                    }
                }
            } else {
                isArray = false;
            }

            if(isArray) {
                if(useLocalStorage) {
                    var returnVal = {};
                    for(i = 0; i < keyOrKeys.length; i += 1) {
                        returnVal[keyOrKeys[i]] = localStorage.getItem(keyOrKeys[i]);
                    }
                    if(fn) {
                        fn(true, returnVal);
                    }
                } else {
                    url = buildUrl(appId, null, token) + "&" + $.param({"keys": JSON.stringify(keyOrKeys)});
                }
            } else {
                console.error("Key is not a string or array of strings - ", keyOrKeys);
                if(fn) { fn(false); }
            }
        }

        if(url !== "") {
            $.ajax({
                url: url,
                dataType: "json",
                success: function(data) {
                    if(!data["success"] && data["message"]) {
                        console.error("Error in API request - " + data["message"]);
                    }
                    if(fn) { fn(data["success"], data["data"]); }
                },
                error: getErrorHandler(fn)
            });
        }
    }
    this["get"] = get;

    function getObject(keyOrKeys, fn) {
        this.get(keyOrKeys, function(success, data) {
            var key;
            if(fn) {
                if(success && data) {
                    if(typeof(data) === "string") {
                        fn(success, JSON.parse(data));
                    } else {
                        for(key in data) {
                            if(data.hasOwnProperty(key) && data[key] !== null) {
                                data[key] = JSON.parse(data[key]);
                            }
                        }
                        fn(success, data);
                    }
                } else {
                    fn(success, data);
                }
            }
        });
    }
    this["getObject"] = getObject;

    function isUsingLocalStorage() {
        return useLocalStorage;
    }
    this["isUsingLocalStorage"] = isUsingLocalStorage;

    function login() {
        localStorage.removeItem(userDeclinedStorageKey);
        redirectToLogin();
    }
    this["login"] = login;
};
