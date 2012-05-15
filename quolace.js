/*

Quolace v0.1 - By Alasdair North
http://quolace.appspot.com

Copyright © 2012, Alasdair North
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of Alasdair North nor the
      names of other contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL ALASDAIR NORTH OR OTHER CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/

/*jslint browser: true, sloppy: true, white: true, maxerr: 50, indent: 4 */

function Quolace(appId) {
    var $ = jQuery,
        urlRoot = "https://quolace.appspot.com/",
        maxKeyLength = 500,
        maxValueLength = 10000,
        tokenStorageKey = "quolace_token_" + appId,
        initialUrlStorageKey = "quolace_initial_url" + appId,
        token = localStorage.getItem(tokenStorageKey);
    
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
        return function(jqXHR, textStatus, errorThrown) {
            if(fn) { fn(false); }
        };
    }

    function buildUrl(appId, key, token) {
        var url = urlRoot + "api/1/apps/" + encodeURIComponent(appId) + "/values";
        if(key) {
            url += "/" + encodeURIComponent(key);
        }
        return url + "?" + $.param({"token": token});
    }
    
    function init(fn) {
        if(getParameterByName("success") === "false") {
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
                            token = data.token;
                            localStorage.setItem(tokenStorageKey, token);
                            history.replaceState({}, "", localStorage.getItem(initialUrlStorageKey));
                            localStorage.removeItem(initialUrlStorageKey);
                            fn(true);
                        } else {
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
    this.init = init;
    
    function set(key, value, fn) {
        if(typeof(key) !== "string") {
            if(fn) { fn(false); }
            console.error("Key is not a string - ", key);
        } else if(typeof(value) !== "string") {
            if(fn) { fn(false); }
            console.error("Value is not a string - ", value);
        } else {
            if(key.length > maxKeyLength) {
                if(fn) { fn(false); }
                console.error("Key is " + key.length + " characters long, the maximum key length is " + maxKeyLength + " - ", key);
            } else if (value.length > maxValueLength) {
                if(fn) { fn(false); }
                console.error("Value is " + value.length + " characters long, the maximum value length is " + maxValueLength + " - ", value);
            } else {
                var url = buildUrl(appId, key, token);
                $.ajax({
                    type: "POST",
                    url: url,
                    data: {"value": value || ""},
                    success: function(data) {
                        if(!data.success && data.message) {
                            console.error("Error in API request - " + data.message);
                        }
                        if(fn) { fn(data.success); }
                    },
                    dataType: "json",
                    error: getErrorHandler(fn)
                });
            }
        }
    }
    this.set = set;

    function setObject(key, value, fn) {
        this.set(key, value === null ? "" : JSON.stringify(value), fn);
    }
    this.setObject = setObject;
    
    function get(keyOrKeys, fn) {
        var url = "";
        if(typeof(keyOrKeys) === "string") {
            url = buildUrl(appId, keyOrKeys, token);
        } else {
            //  Check that this is a valid array of strings
            var isArray = true,
                i = 0;
            if(Object.prototype.toString.call(keyOrKeys) === "[object Array]") {
                for(; i < keyOrKeys.length; i++) {
                    if(typeof(keyOrKeys[i]) !== "string") {
                        isArray = false;
                    }
                }
            } else {
                isArray = false;
            }
            if(isArray) {
                url = buildUrl(appId, null, token) + "&" + $.param({"keys": JSON.stringify(keyOrKeys)});
            } else {
                console.error("Key is not a string or array of strings - ", keyOrKeys);
            }
        }
        if(url !== "") {
            $.ajax({
                url: url,
                dataType: "json",
                success: function(data) {
                    if(!data.success && data.message) {
                        console.error("Error in API request - " + data.message);
                    }
                    if(fn) { fn(data.success, data.data); }
                },
                error: getErrorHandler(fn)
            });
        } else {
            if(fn) { fn(false); }
        }
    }
    this.get = get;

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
    this.getObject = getObject;
}
