"use strict";
/**
 * Copyright (c) Microsoft Corporation
 *  All Rights Reserved
 *  MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the 'Software'), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
 * OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
 * OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var AccessTokenKey_1 = require("./AccessTokenKey");
var AccessTokenValue_1 = require("./AccessTokenValue");
var AuthenticationRequestParameters_1 = require("./AuthenticationRequestParameters");
var ClientInfo_1 = require("./ClientInfo");
var Constants_1 = require("./Constants");
var IdToken_1 = require("./IdToken");
var Logger_1 = require("./Logger");
var Storage_1 = require("./Storage");
var RequestInfo_1 = require("./RequestInfo");
var User_1 = require("./User");
var Utils_1 = require("./Utils");
var AuthorityFactory_1 = require("./AuthorityFactory");
/*
 * @hidden
 */
var ResponseTypes = {
    id_token: "id_token",
    token: "token",
    id_token_token: "id_token token"
};
var resolveTokenOnlyIfOutOfIframe = function (target, propertyKey, descriptor) {
    var tokenAcquisitionMethod = descriptor.value;
    descriptor.value = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return this.isInIframe()
            ? new Promise(function () { })
            : tokenAcquisitionMethod.apply(this, args);
    };
    return descriptor;
};
var UserAgentApplication = /** @class */ (function () {
    /*
     * Initialize a UserAgentApplication with a given clientId and authority.
     * @constructor
     * @param {string} clientId - The clientID of your application, you should get this from the application registration portal.
     * @param {string} authority - A URL indicating a directory that MSAL can use to obtain tokens.
     * - In Azure AD, it is of the form https://&lt;instance>/&lt;tenant&gt;,\ where &lt;instance&gt; is the directory host (e.g. https://login.microsoftonline.com) and &lt;tenant&gt; is a identifier within the directory itself (e.g. a domain associated to the tenant, such as contoso.onmicrosoft.com, or the GUID representing the TenantID property of the directory)
     * - In Azure B2C, it is of the form https://&lt;instance&gt;/tfp/&lt;tenantId&gt;/&lt;policyName&gt;/
     * - Default value is: "https://login.microsoftonline.com/common"
     * @param _tokenReceivedCallback -  The function that will get the call back once this API is completed (either successfully or with a failure).
     * @param {boolean} validateAuthority -  boolean to turn authority validation on/off.
     */
    function UserAgentApplication(clientId, authority, tokenReceivedCallback, options) {
        if (options === void 0) { options = {}; }
        /*
         * @hidden
         */
        this._cacheLocations = {
            localStorage: "localStorage",
            sessionStorage: "sessionStorage"
        };
        /*
         * @hidden
         */
        this._clockSkew = 300;
        /*
         * @hidden
         */
        this._tokenReceivedCallback = null;
        this._isAngular = false;
        var _a = options.validateAuthority, validateAuthority = _a === void 0 ? true : _a, _b = options.cacheLocation, cacheLocation = _b === void 0 ? "sessionStorage" : _b, _c = options.redirectUri, redirectUri = _c === void 0 ? window.location.href.split("?")[0].split("#")[0] : _c, _d = options.postLogoutRedirectUri, postLogoutRedirectUri = _d === void 0 ? window.location.href.split("?")[0].split("#")[0] : _d, _e = options.logger, logger = _e === void 0 ? new Logger_1.Logger(null) : _e, _f = options.loadFrameTimeout, loadFrameTimeout = _f === void 0 ? 6000 : _f, _g = options.navigateToLoginRequestUrl, navigateToLoginRequestUrl = _g === void 0 ? true : _g, _h = options.isAngular, isAngular = _h === void 0 ? false : _h, _j = options.anonymousEndpoints, anonymousEndpoints = _j === void 0 ? new Array() : _j, _k = options.endPoints, endPoints = _k === void 0 ? new Map() : _k;
        this.loadFrameTimeout = loadFrameTimeout;
        this.clientId = clientId;
        this.validateAuthority = validateAuthority;
        this.authority = authority || "https://login.microsoftonline.com/common";
        this._tokenReceivedCallback = tokenReceivedCallback;
        this._redirectUri = redirectUri;
        this._postLogoutredirectUri = postLogoutRedirectUri;
        this._loginInProgress = false;
        this._acquireTokenInProgress = false;
        this._cacheLocation = cacheLocation;
        this._navigateToLoginRequestUrl = navigateToLoginRequestUrl;
        this._isAngular = isAngular;
        this._anonymousEndpoints = anonymousEndpoints;
        this._endpoints = endPoints;
        if (!this._cacheLocations[cacheLocation]) {
            throw new Error("Cache Location is not valid. Provided value:" + this._cacheLocation + ".Possible values are: " + this._cacheLocations.localStorage + ", " + this._cacheLocations.sessionStorage);
        }
        this._cacheStorage = new Storage_1.Storage(this._cacheLocation); //cache keys msal
        this._logger = logger;
        window.openedWindows = [];
        window.activeRenewals = {};
        window.renewStates = [];
        window.callBackMappedToRenewStates = {};
        window.callBacksMappedToRenewStates = {};
        window.msal = this;
        var urlHash = window.location.hash;
        var isCallback = this.isCallback(urlHash);
        if (!this._isAngular) {
            if (isCallback) {
                this.handleAuthenticationResponse.call(this, urlHash);
            }
            else {
                var pendingCallback = this._cacheStorage.getItem(Constants_1.Constants.urlHash);
                if (pendingCallback) {
                    this.processCallBack(pendingCallback);
                }
            }
        }
    }
    Object.defineProperty(UserAgentApplication.prototype, "cacheLocation", {
        /*
         * Used to get the cache location
         */
        get: function () {
            return this._cacheLocation;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(UserAgentApplication.prototype, "authority", {
        /*
         * Used to get the authority.
         */
        get: function () {
            return this.authorityInstance.CanonicalAuthority;
        },
        /*
         * Used to set the authority.
         * @param {string} authority - A URL indicating a directory that MSAL can use to obtain tokens.
         * - In Azure AD, it is of the form https://&lt;tenant&gt;/&lt;tenant&gt;, where &lt;tenant&gt; is the directory host (e.g. https://login.microsoftonline.com) and &lt;tenant&gt; is a identifier within the directory itself (e.g. a domain associated to the tenant, such as contoso.onmicrosoft.com, or the GUID representing the TenantID property of the directory)
         * - In Azure B2C, it is of the form https://&lt;instance&gt;/tfp/&lt;tenant&gt;/<policyName>/
         * - Default value is: "https://login.microsoftonline.com/common"
         */
        set: function (val) {
            this.authorityInstance = AuthorityFactory_1.AuthorityFactory.CreateInstance(val, this.validateAuthority);
        },
        enumerable: true,
        configurable: true
    });
    /*
     * Used to call the constructor callback with the token/error
     * @param {string} [hash=window.location.hash] - Hash fragment of Url.
     * @hidden
     */
    UserAgentApplication.prototype.processCallBack = function (hash) {
        this._logger.info('Processing the callback from redirect response');
        var requestInfo = this.getRequestInfo(hash);
        this.saveTokenFromHash(requestInfo);
        var token = requestInfo.parameters[Constants_1.Constants.accessToken] || requestInfo.parameters[Constants_1.Constants.idToken];
        var errorDesc = requestInfo.parameters[Constants_1.Constants.errorDescription];
        var error = requestInfo.parameters[Constants_1.Constants.error];
        var tokenType;
        if (requestInfo.parameters[Constants_1.Constants.accessToken]) {
            tokenType = Constants_1.Constants.accessToken;
        }
        else {
            tokenType = Constants_1.Constants.idToken;
        }
        this._cacheStorage.removeItem(Constants_1.Constants.urlHash);
        try {
            if (this._tokenReceivedCallback) {
                this._tokenReceivedCallback.call(this, errorDesc, token, error, tokenType);
            }
        }
        catch (err) {
            this._logger.error("Error occurred in token received callback function: " + err);
        }
    };
    /*
     * Initiate the login process by redirecting the user to the STS authorization endpoint.
     * @param {Array.<string>} scopes - Permissions you want included in the access token. Not all scopes are guaranteed to be included in the access token returned.
     * @param {string} extraQueryParameters - Key-value pairs to pass to the authentication server during the interactive authentication flow.
     */
    UserAgentApplication.prototype.loginRedirect = function (scopes, extraQueryParameters) {
        var _this = this;
        /*
        1. Create navigate url
        2. saves value in cache
        3. redirect user to AAD
         */
        if (this._loginInProgress) {
            if (this._tokenReceivedCallback) {
                this._tokenReceivedCallback(Constants_1.ErrorDescription.loginProgressError, null, Constants_1.ErrorCodes.loginProgressError, Constants_1.Constants.idToken);
                return;
            }
        }
        if (scopes) {
            var isValidScope = this.validateInputScope(scopes);
            if (isValidScope && !Utils_1.Utils.isEmpty(isValidScope)) {
                if (this._tokenReceivedCallback) {
                    this._tokenReceivedCallback(Constants_1.ErrorDescription.inputScopesError, null, Constants_1.ErrorCodes.inputScopesError, Constants_1.Constants.idToken);
                    return;
                }
            }
            scopes = this.filterScopes(scopes);
        }
        this._loginInProgress = true;
        this.authorityInstance.ResolveEndpointsAsync()
            .then(function () {
            var authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(_this.authorityInstance, _this.clientId, scopes, ResponseTypes.id_token, _this._redirectUri);
            if (extraQueryParameters) {
                authenticationRequest.extraQueryParameters = extraQueryParameters;
            }
            var loginStartPage = _this._cacheStorage.getItem(Constants_1.Constants.angularLoginRequest);
            if (!loginStartPage || loginStartPage === "") {
                loginStartPage = window.location.href;
            }
            else {
                _this._cacheStorage.setItem(Constants_1.Constants.angularLoginRequest, "");
            }
            _this._cacheStorage.setItem(Constants_1.Constants.loginRequest, loginStartPage);
            _this._cacheStorage.setItem(Constants_1.Constants.loginError, "");
            _this._cacheStorage.setItem(Constants_1.Constants.stateLogin, authenticationRequest.state);
            _this._cacheStorage.setItem(Constants_1.Constants.nonceIdToken, authenticationRequest.nonce);
            _this._cacheStorage.setItem(Constants_1.Constants.msalError, "");
            _this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, "");
            var authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
            if (Utils_1.Utils.isEmpty(_this._cacheStorage.getItem(authorityKey))) {
                _this._cacheStorage.setItem(authorityKey, _this.authority);
            }
            var urlNavigate = authenticationRequest.createNavigateUrl(scopes) + "&prompt=select_account" + "&response_mode=fragment";
            _this.promptUser(urlNavigate);
        });
    };
    /*
     * Initiate the login process by opening a popup window.
     * @param {Array.<string>} scopes - Permissions you want included in the access token. Not all scopes are  guaranteed to be included in the access token returned.
     * @param {string} extraQueryParameters - Key-value pairs to pass to the STS during the interactive authentication flow.
     * @returns {Promise.<string>} - A Promise that is fulfilled when this function has completed, or rejected if an error was raised. Returns the token or error.
     */
    UserAgentApplication.prototype.loginPopup = function (scopes, extraQueryParameters) {
        var _this = this;
        /*
        1. Create navigate url
        2. saves value in cache
        3. redirect user to AAD
         */
        return new Promise(function (resolve, reject) {
            if (_this._loginInProgress) {
                reject(Constants_1.ErrorCodes.loginProgressError + "|" + Constants_1.ErrorDescription.loginProgressError);
                return;
            }
            if (scopes) {
                var isValidScope = _this.validateInputScope(scopes);
                if (isValidScope && !Utils_1.Utils.isEmpty(isValidScope)) {
                    reject(Constants_1.ErrorCodes.inputScopesError + "|" + Constants_1.ErrorDescription.inputScopesError);
                    return;
                }
                scopes = _this.filterScopes(scopes);
            }
            else {
                scopes = [_this.clientId];
            }
            var scope = scopes.join(" ").toLowerCase();
            var popUpWindow = _this.openWindow("about:blank", "_blank", 1, _this, resolve, reject);
            if (!popUpWindow) {
                return;
            }
            _this._loginInProgress = true;
            _this.authorityInstance.ResolveEndpointsAsync().then(function () {
                var authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(_this.authorityInstance, _this.clientId, scopes, ResponseTypes.id_token, _this._redirectUri);
                if (extraQueryParameters) {
                    authenticationRequest.extraQueryParameters = extraQueryParameters;
                }
                _this._cacheStorage.setItem(Constants_1.Constants.loginRequest, window.location.href);
                _this._cacheStorage.setItem(Constants_1.Constants.loginError, "");
                _this._cacheStorage.setItem(Constants_1.Constants.nonceIdToken, authenticationRequest.nonce);
                _this._cacheStorage.setItem(Constants_1.Constants.msalError, "");
                _this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, "");
                var authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
                if (Utils_1.Utils.isEmpty(_this._cacheStorage.getItem(authorityKey))) {
                    _this._cacheStorage.setItem(authorityKey, _this.authority);
                }
                var urlNavigate = authenticationRequest.createNavigateUrl(scopes) + "&prompt=select_account" + "&response_mode=fragment";
                window.renewStates.push(authenticationRequest.state);
                window.requestType = Constants_1.Constants.login;
                _this.registerCallback(authenticationRequest.state, scope, resolve, reject);
                if (popUpWindow) {
                    _this._logger.infoPii("Navigated Popup window to:" + urlNavigate);
                    popUpWindow.location.href = urlNavigate;
                }
            }, function () {
                _this._logger.info(Constants_1.ErrorCodes.endpointResolutionError + ":" + Constants_1.ErrorDescription.endpointResolutionError);
                _this._cacheStorage.setItem(Constants_1.Constants.msalError, Constants_1.ErrorCodes.endpointResolutionError);
                _this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, Constants_1.ErrorDescription.endpointResolutionError);
                if (reject) {
                    reject(Constants_1.ErrorCodes.endpointResolutionError + ":" + Constants_1.ErrorDescription.endpointResolutionError);
                }
                if (popUpWindow) {
                    popUpWindow.close();
                }
            });
        });
    };
    /*
      * Used to redirect the browser to the STS authorization endpoint
      * @param {string} urlNavigate - URL of the authorization endpoint
      * @hidden
      */
    UserAgentApplication.prototype.promptUser = function (urlNavigate) {
        if (urlNavigate && !Utils_1.Utils.isEmpty(urlNavigate)) {
            this._logger.infoPii("Navigate to:" + urlNavigate);
            window.location.replace(urlNavigate);
        }
        else {
            this._logger.info("Navigate url is empty");
        }
    };
    /*
     * Used to send the user to the redirect_uri after authentication is complete. The user"s bearer token is attached to the URI fragment as an id_token/access_token field.
     * This function also closes the popup window after redirection.
     * @hidden
     * @ignore
     */
    UserAgentApplication.prototype.openWindow = function (urlNavigate, title, interval, instance, resolve, reject) {
        var _this = this;
        var popupWindow = this.openPopup(urlNavigate, title, Constants_1.Constants.popUpWidth, Constants_1.Constants.popUpHeight);
        if (popupWindow == null) {
            instance._loginInProgress = false;
            instance._acquireTokenInProgress = false;
            this._logger.info(Constants_1.ErrorCodes.popUpWindowError + ":" + Constants_1.ErrorDescription.popUpWindowError);
            this._cacheStorage.setItem(Constants_1.Constants.msalError, Constants_1.ErrorCodes.popUpWindowError);
            this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, Constants_1.ErrorDescription.popUpWindowError);
            if (reject) {
                reject(Constants_1.ErrorCodes.popUpWindowError + "|" + Constants_1.ErrorDescription.popUpWindowError);
            }
            return null;
        }
        window.openedWindows.push(popupWindow);
        var pollTimer = window.setInterval(function () {
            if (popupWindow && popupWindow.closed && instance._loginInProgress) {
                if (reject) {
                    reject(Constants_1.ErrorCodes.userCancelledError + "|" + Constants_1.ErrorDescription.userCancelledError);
                }
                window.clearInterval(pollTimer);
                if (_this._isAngular) {
                    _this.broadcast('msal:popUpClosed', Constants_1.ErrorCodes.userCancelledError + "|" + Constants_1.ErrorDescription.userCancelledError);
                    return;
                }
                instance._loginInProgress = false;
                instance._acquireTokenInProgress = false;
            }
            try {
                var popUpWindowLocation = popupWindow.location;
                if (popUpWindowLocation.href.indexOf(_this._redirectUri) !== -1) {
                    window.clearInterval(pollTimer);
                    instance._loginInProgress = false;
                    instance._acquireTokenInProgress = false;
                    _this._logger.info("Closing popup window");
                    if (_this._isAngular) {
                        _this.broadcast('msal:popUpHashChanged', popUpWindowLocation.hash);
                        for (var i = 0; i < window.openedWindows.length; i++) {
                            window.openedWindows[i].close();
                        }
                    }
                }
            }
            catch (e) {
                //Cross Domain url check error. Will be thrown until AAD redirects the user back to the app"s root page with the token. No need to log or throw this error as it will create unnecessary traffic.
            }
        }, interval);
        return popupWindow;
    };
    UserAgentApplication.prototype.broadcast = function (eventName, data) {
        var evt = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(evt);
    };
    /*
     * Used to log out the current user, and redirect the user to the postLogoutRedirectUri.
     * Defaults behaviour is to redirect the user to `window.location.href`.
     */
    UserAgentApplication.prototype.logout = function () {
        this.clearCache();
        this._user = null;
        var logout = "";
        if (this._postLogoutredirectUri) {
            logout = "post_logout_redirect_uri=" + encodeURIComponent(this._postLogoutredirectUri);
        }
        var urlNavigate = this.authority + "/oauth2/v2.0/logout?" + logout;
        this.promptUser(urlNavigate);
    };
    /*
     * Used to configure the popup window for login.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.clearCache = function () {
        window.renewStates = [];
        var accessTokenItems = this._cacheStorage.getAllAccessTokens(Constants_1.Constants.clientId, Constants_1.Constants.userIdentifier);
        for (var i = 0; i < accessTokenItems.length; i++) {
            this._cacheStorage.removeItem(JSON.stringify(accessTokenItems[i].key));
        }
        this._cacheStorage.resetCacheItems();
    };
    UserAgentApplication.prototype.clearCacheForScope = function (accessToken) {
        var accessTokenItems = this._cacheStorage.getAllAccessTokens(Constants_1.Constants.clientId, Constants_1.Constants.userIdentifier);
        for (var i = 0; i < accessTokenItems.length; i++) {
            var token = accessTokenItems[i];
            if (token.value.accessToken == accessToken) {
                this._cacheStorage.removeItem(JSON.stringify(token.key));
            }
        }
    };
    /*
     * Configures popup window for login.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.openPopup = function (urlNavigate, title, popUpWidth, popUpHeight) {
        try {
            /*
             * adding winLeft and winTop to account for dual monitor
             * using screenLeft and screenTop for IE8 and earlier
             */
            var winLeft = window.screenLeft ? window.screenLeft : window.screenX;
            var winTop = window.screenTop ? window.screenTop : window.screenY;
            /*
             * window.innerWidth displays browser window"s height and width excluding toolbars
             * using document.documentElement.clientWidth for IE8 and earlier
             */
            var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            var height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
            var left = ((width / 2) - (popUpWidth / 2)) + winLeft;
            var top_1 = ((height / 2) - (popUpHeight / 2)) + winTop;
            var popupWindow = window.open(urlNavigate, title, "width=" + popUpWidth + ", height=" + popUpHeight + ", top=" + top_1 + ", left=" + left);
            if (popupWindow.focus) {
                popupWindow.focus();
            }
            return popupWindow;
        }
        catch (e) {
            this._logger.error("error opening popup " + e.message);
            this._loginInProgress = false;
            this._acquireTokenInProgress = false;
            return null;
        }
    };
    /*
     * Used to validate the scopes input parameter requested  by the developer.
     * @param {Array<string>} scopes - Developer requested permissions. Not all scopes are guaranteed to be included in the access token returned.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.validateInputScope = function (scopes) {
        if (!scopes || scopes.length < 1) {
            return "Scopes cannot be passed as an empty array";
        }
        if (!Array.isArray(scopes)) {
            throw new Error("API does not accept non-array scopes");
        }
        if (scopes.indexOf(this.clientId) > -1) {
            if (scopes.length > 1) {
                return "ClientId can only be provided as a single scope";
            }
        }
        return "";
    };
    /*
      * Used to remove openid and profile from the list of scopes passed by the developer.These scopes are added by default
      * @hidden
      */
    UserAgentApplication.prototype.filterScopes = function (scopes) {
        scopes = scopes.filter(function (element) {
            return element !== "openid";
        });
        scopes = scopes.filter(function (element) {
            return element !== "profile";
        });
        return scopes;
    };
    /*
     * Used to add the developer requested callback to the array of callbacks for the specified scopes. The updated array is stored on the window object
     * @param {string} scope - Developer requested permissions. Not all scopes are guaranteed to be included in the access token returned.
     * @param {string} expectedState - Unique state identifier (guid).
     * @param {Function} resolve - The resolve function of the promise object.
     * @param {Function} reject - The reject function of the promise object.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.registerCallback = function (expectedState, scope, resolve, reject) {
        var _this = this;
        window.activeRenewals[scope] = expectedState;
        if (!window.callBacksMappedToRenewStates[expectedState]) {
            window.callBacksMappedToRenewStates[expectedState] = [];
        }
        window.callBacksMappedToRenewStates[expectedState].push({ resolve: resolve, reject: reject });
        if (!window.callBackMappedToRenewStates[expectedState]) {
            window.callBackMappedToRenewStates[expectedState] =
                function (errorDesc, token, error, tokenType) {
                    window.activeRenewals[scope] = null;
                    for (var i = 0; i < window.callBacksMappedToRenewStates[expectedState].length; ++i) {
                        try {
                            if (errorDesc || error) {
                                window.callBacksMappedToRenewStates[expectedState][i].reject(errorDesc + "|" + error);
                            }
                            else if (token) {
                                window.callBacksMappedToRenewStates[expectedState][i].resolve(token);
                            }
                        }
                        catch (e) {
                            _this._logger.warning(e);
                        }
                    }
                    window.callBacksMappedToRenewStates[expectedState] = null;
                    window.callBackMappedToRenewStates[expectedState] = null;
                };
        }
    };
    /*
     * Used to get token for the specified set of scopes from the cache
     * @param {AuthenticationRequestParameters} authenticationRequest - Request sent to the STS to obtain an id_token/access_token
     * @param {User} user - User for which the scopes were requested
     * @hidden
     */
    UserAgentApplication.prototype.getCachedToken = function (authenticationRequest, user) {
        var accessTokenCacheItem = null;
        var scopes = authenticationRequest.scopes;
        var tokenCacheItems = this._cacheStorage.getAllAccessTokens(this.clientId, user ? user.userIdentifier : null); //filter by clientId and user
        if (tokenCacheItems.length === 0) {
            return null;
        }
        var filteredItems = [];
        //if no authority passed
        if (!authenticationRequest.authority) {
            //filter by scope
            for (var i = 0; i < tokenCacheItems.length; i++) {
                var cacheItem = tokenCacheItems[i];
                var cachedScopes = cacheItem.key.scopes.split(" ");
                if (Utils_1.Utils.containsScope(cachedScopes, scopes)) {
                    filteredItems.push(cacheItem);
                }
            }
            //if only one cached token found
            if (filteredItems.length === 1) {
                accessTokenCacheItem = filteredItems[0];
                authenticationRequest.authorityInstance = AuthorityFactory_1.AuthorityFactory.CreateInstance(accessTokenCacheItem.key.authority, this.validateAuthority);
            }
            else if (filteredItems.length > 1) {
                return {
                    errorDesc: "The cache contains multiple tokens satisfying the requirements. Call AcquireToken again providing more requirements like authority",
                    token: null,
                    error: "multiple_matching_tokens_detected"
                };
            }
            else {
                //no match found. check if there was a single authority used
                var authorityList = this.getUniqueAuthority(tokenCacheItems, "authority");
                if (authorityList.length > 1) {
                    return {
                        errorDesc: "Multiple authorities found in the cache. Pass authority in the API overload.",
                        token: null,
                        error: "multiple_matching_tokens_detected"
                    };
                }
                authenticationRequest.authorityInstance = AuthorityFactory_1.AuthorityFactory.CreateInstance(authorityList[0], this.validateAuthority);
            }
        }
        else {
            //authority was passed in the API, filter by authority and scope
            for (var i = 0; i < tokenCacheItems.length; i++) {
                var cacheItem = tokenCacheItems[i];
                var cachedScopes = cacheItem.key.scopes.split(" ");
                if (Utils_1.Utils.containsScope(cachedScopes, scopes) && cacheItem.key.authority === authenticationRequest.authority) {
                    filteredItems.push(cacheItem);
                }
            }
            //no match
            if (filteredItems.length === 0) {
                return null;
            }
            else if (filteredItems.length === 1) {
                accessTokenCacheItem = filteredItems[0];
            }
            else {
                //more than one match found.
                return {
                    errorDesc: "The cache contains multiple tokens satisfying the requirements.Call AcquireToken again providing more requirements like authority",
                    token: null,
                    error: "multiple_matching_tokens_detected"
                };
            }
        }
        if (accessTokenCacheItem != null) {
            var expired = Number(accessTokenCacheItem.value.expiresIn);
            // If expiration is within offset, it will force renew
            var offset = this._clockSkew || 300;
            if (expired && (expired > Utils_1.Utils.now() + offset)) {
                return {
                    errorDesc: null,
                    token: accessTokenCacheItem.value.accessToken,
                    error: null
                };
            }
            else {
                this._cacheStorage.removeItem(JSON.stringify(filteredItems[0].key));
                return null;
            }
        }
        else {
            return null;
        }
    };
    /*
     * Used to filter all cached items and return a list of unique users based on userIdentifier.
     * @param {Array<User>} Users - users saved in the cache.
     */
    UserAgentApplication.prototype.getAllUsers = function () {
        var users = [];
        var accessTokenCacheItems = this._cacheStorage.getAllAccessTokens(Constants_1.Constants.clientId, Constants_1.Constants.userIdentifier);
        for (var i = 0; i < accessTokenCacheItems.length; i++) {
            var idToken = new IdToken_1.IdToken(accessTokenCacheItems[i].value.idToken);
            var clientInfo = new ClientInfo_1.ClientInfo(accessTokenCacheItems[i].value.clientInfo);
            var user = User_1.User.createUser(idToken, clientInfo, this.authority);
            users.push(user);
        }
        return this.getUniqueUsers(users);
    };
    /*
     * Used to filter users based on userIdentifier
     * @param {Array<User>}  Users - users saved in the cache
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.getUniqueUsers = function (users) {
        if (!users || users.length <= 1) {
            return users;
        }
        var flags = [];
        var uniqueUsers = [];
        for (var index = 0; index < users.length; ++index) {
            if (users[index].userIdentifier && flags.indexOf(users[index].userIdentifier) === -1) {
                flags.push(users[index].userIdentifier);
                uniqueUsers.push(users[index]);
            }
        }
        return uniqueUsers;
    };
    /*
    * Used to get a unique list of authoritues from the cache
    * @param {Array<AccessTokenCacheItem>}  accessTokenCacheItems - accessTokenCacheItems saved in the cache
    * @ignore
    * @hidden
    */
    UserAgentApplication.prototype.getUniqueAuthority = function (accessTokenCacheItems, property) {
        var authorityList = [];
        var flags = [];
        accessTokenCacheItems.forEach(function (element) {
            if (element.key.hasOwnProperty(property) && (flags.indexOf(element.key[property]) === -1)) {
                flags.push(element.key[property]);
                authorityList.push(element.key[property]);
            }
        });
        return authorityList;
    };
    /*
     * Adds login_hint to authorization URL which is used to pre-fill the username field of sign in page for the user if known ahead of time
     * domain_hint can be one of users/organisations which when added skips the email based discovery process of the user
     * domain_req utid received as part of the clientInfo
     * login_req uid received as part of clientInfo
     * @param {string} urlNavigate - Authentication request url
     * @param {User} user - User for which the token is requested
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.addHintParameters = function (urlNavigate, user) {
        var userObject = user ? user : this.getUser();
        var decodedClientInfo = userObject.userIdentifier.split(".");
        var uid = Utils_1.Utils.base64DecodeStringUrlSafe(decodedClientInfo[0]);
        var utid = Utils_1.Utils.base64DecodeStringUrlSafe(decodedClientInfo[1]);
        if (!this.urlContainsQueryStringParameter("login_hint", urlNavigate) && userObject.displayableId && !Utils_1.Utils.isEmpty(userObject.displayableId)) {
            urlNavigate += "&login_hint=" + encodeURIComponent(user.displayableId);
        }
        if (!Utils_1.Utils.isEmpty(uid) && !Utils_1.Utils.isEmpty(utid)) {
            if (!this.urlContainsQueryStringParameter("domain_req", urlNavigate) && !Utils_1.Utils.isEmpty(utid)) {
                urlNavigate += "&domain_req=" + encodeURIComponent(utid);
            }
            if (!this.urlContainsQueryStringParameter("login_req", urlNavigate) && !Utils_1.Utils.isEmpty(uid)) {
                urlNavigate += "&login_req=" + encodeURIComponent(uid);
            }
            if (!this.urlContainsQueryStringParameter("domain_hint", urlNavigate) && !Utils_1.Utils.isEmpty(utid)) {
                if (utid === "9188040d-6c67-4c5b-b112-36a304b66dad") {
                    urlNavigate += "&domain_hint=" + encodeURIComponent("consumers");
                }
                else {
                    urlNavigate += "&domain_hint=" + encodeURIComponent("organizations");
                }
            }
        }
        return urlNavigate;
    };
    /*
     * Checks if the authorization endpoint URL contains query string parameters
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.urlContainsQueryStringParameter = function (name, url) {
        // regex to detect pattern of a ? or & followed by the name parameter and an equals character
        var regex = new RegExp("[\\?&]" + name + "=");
        return regex.test(url);
    };
    UserAgentApplication.prototype.acquireTokenRedirect = function (scopes, authority, user, extraQueryParameters) {
        var _this = this;
        var isValidScope = this.validateInputScope(scopes);
        if (isValidScope && !Utils_1.Utils.isEmpty(isValidScope)) {
            if (this._tokenReceivedCallback) {
                this._tokenReceivedCallback(Constants_1.ErrorDescription.inputScopesError, null, Constants_1.ErrorCodes.inputScopesError, Constants_1.Constants.accessToken);
                return;
            }
        }
        if (scopes) {
            scopes = this.filterScopes(scopes);
        }
        var userObject = user ? user : this.getUser();
        if (this._acquireTokenInProgress) {
            return;
        }
        var scope = scopes.join(" ").toLowerCase();
        if (!userObject) {
            if (this._tokenReceivedCallback) {
                this._tokenReceivedCallback(Constants_1.ErrorDescription.userLoginError, null, Constants_1.ErrorCodes.userLoginError, Constants_1.Constants.accessToken);
                return;
            }
        }
        this._acquireTokenInProgress = true;
        var authenticationRequest;
        var acquireTokenAuthority = authority ? AuthorityFactory_1.AuthorityFactory.CreateInstance(authority, this.validateAuthority) : this.authorityInstance;
        acquireTokenAuthority.ResolveEndpointsAsync().then(function () {
            if (Utils_1.Utils.compareObjects(userObject, _this.getUser())) {
                authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(acquireTokenAuthority, _this.clientId, scopes, ResponseTypes.token, _this._redirectUri);
            }
            else {
                authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(acquireTokenAuthority, _this.clientId, scopes, ResponseTypes.id_token_token, _this._redirectUri);
            }
            _this._cacheStorage.setItem(Constants_1.Constants.nonceIdToken, authenticationRequest.nonce);
            var acquireTokenUserKey = Constants_1.Constants.acquireTokenUser + Constants_1.Constants.resourceDelimeter + userObject.userIdentifier + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
            if (Utils_1.Utils.isEmpty(_this._cacheStorage.getItem(acquireTokenUserKey))) {
                _this._cacheStorage.setItem(acquireTokenUserKey, JSON.stringify(userObject));
            }
            var authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
            if (Utils_1.Utils.isEmpty(_this._cacheStorage.getItem(authorityKey))) {
                _this._cacheStorage.setItem(authorityKey, acquireTokenAuthority.CanonicalAuthority);
            }
            if (extraQueryParameters) {
                authenticationRequest.extraQueryParameters = extraQueryParameters;
            }
            var urlNavigate = authenticationRequest.createNavigateUrl(scopes) + "&prompt=select_account" + "&response_mode=fragment";
            urlNavigate = _this.addHintParameters(urlNavigate, userObject);
            if (urlNavigate) {
                _this._cacheStorage.setItem(Constants_1.Constants.stateAcquireToken, authenticationRequest.state);
                window.location.replace(urlNavigate);
            }
        });
    };
    UserAgentApplication.prototype.acquireTokenPopup = function (scopes, authority, user, extraQueryParameters) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var isValidScope = _this.validateInputScope(scopes);
            if (isValidScope && !Utils_1.Utils.isEmpty(isValidScope)) {
                reject(Constants_1.ErrorCodes.inputScopesError + "|" + isValidScope);
            }
            if (scopes) {
                scopes = _this.filterScopes(scopes);
            }
            var userObject = user ? user : _this.getUser();
            if (_this._acquireTokenInProgress) {
                reject(Constants_1.ErrorCodes.acquireTokenProgressError + "|" + Constants_1.ErrorDescription.acquireTokenProgressError);
                return;
            }
            var scope = scopes.join(" ").toLowerCase();
            if (!userObject) {
                reject(Constants_1.ErrorCodes.userLoginError + "|" + Constants_1.ErrorDescription.userLoginError);
                return;
            }
            _this._acquireTokenInProgress = true;
            var authenticationRequest;
            var acquireTokenAuthority = authority ? AuthorityFactory_1.AuthorityFactory.CreateInstance(authority, _this.validateAuthority) : _this.authorityInstance;
            var popUpWindow = _this.openWindow("about:blank", "_blank", 1, _this, resolve, reject);
            if (!popUpWindow) {
                return;
            }
            acquireTokenAuthority.ResolveEndpointsAsync().then(function () {
                if (Utils_1.Utils.compareObjects(userObject, _this.getUser())) {
                    if (scopes.indexOf(_this.clientId) > -1) {
                        authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(acquireTokenAuthority, _this.clientId, scopes, ResponseTypes.id_token, _this._redirectUri);
                    }
                    else {
                        authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(acquireTokenAuthority, _this.clientId, scopes, ResponseTypes.token, _this._redirectUri);
                    }
                }
                else {
                    authenticationRequest = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(acquireTokenAuthority, _this.clientId, scopes, ResponseTypes.id_token_token, _this._redirectUri);
                }
                _this._cacheStorage.setItem(Constants_1.Constants.nonceIdToken, authenticationRequest.nonce);
                authenticationRequest.state = authenticationRequest.state;
                var acquireTokenUserKey = Constants_1.Constants.acquireTokenUser + Constants_1.Constants.resourceDelimeter + userObject.userIdentifier + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
                if (Utils_1.Utils.isEmpty(_this._cacheStorage.getItem(acquireTokenUserKey))) {
                    _this._cacheStorage.setItem(acquireTokenUserKey, JSON.stringify(userObject));
                }
                var authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
                if (Utils_1.Utils.isEmpty(_this._cacheStorage.getItem(authorityKey))) {
                    _this._cacheStorage.setItem(authorityKey, acquireTokenAuthority.CanonicalAuthority);
                }
                if (extraQueryParameters) {
                    authenticationRequest.extraQueryParameters = extraQueryParameters;
                }
                var urlNavigate = authenticationRequest.createNavigateUrl(scopes) + "&prompt=select_account" + "&response_mode=fragment";
                urlNavigate = _this.addHintParameters(urlNavigate, userObject);
                window.renewStates.push(authenticationRequest.state);
                window.requestType = Constants_1.Constants.renewToken;
                _this.registerCallback(authenticationRequest.state, scope, resolve, reject);
                if (popUpWindow) {
                    popUpWindow.location.href = urlNavigate;
                }
            }, function () {
                _this._logger.info(Constants_1.ErrorCodes.endpointResolutionError + ":" + Constants_1.ErrorDescription.endpointResolutionError);
                _this._cacheStorage.setItem(Constants_1.Constants.msalError, Constants_1.ErrorCodes.endpointResolutionError);
                _this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, Constants_1.ErrorDescription.endpointResolutionError);
                if (reject) {
                    reject(Constants_1.ErrorCodes.endpointResolutionError + "|" + Constants_1.ErrorDescription.endpointResolutionError);
                }
                if (popUpWindow) {
                    popUpWindow.close();
                }
            });
        });
    };
    /*
     * Used to get the token from cache.
     * MSAL will return the cached token if it is not expired.
     * Or it will send a request to the STS to obtain an access_token using a hidden iframe. To renew idToken, clientId should be passed as the only scope in the scopes array.
     * @param {Array<string>} scopes - Permissions you want included in the access token. Not all scopes are  guaranteed to be included in the access token. Scopes like "openid" and "profile" are sent with every request.
     * @param {string} authority - A URL indicating a directory that MSAL can use to obtain tokens.
     * - In Azure AD, it is of the form https://&lt;tenant&gt;/&lt;tenant&gt;, where &lt;tenant&gt; is the directory host (e.g. https://login.microsoftonline.com) and &lt;tenant&gt; is a identifier within the directory itself (e.g. a domain associated to the tenant, such as contoso.onmicrosoft.com, or the GUID representing the TenantID property of the directory)
     * - In Azure B2C, it is of the form https://&lt;instance&gt;/tfp/&lt;tenant&gt;/<policyName>/
     * - Default value is: "https://login.microsoftonline.com/common"
     * @param {User} user - The user for which the scopes are requested.The default user is the logged in user.
     * @param {string} extraQueryParameters - Key-value pairs to pass to the STS during the  authentication flow.
     * @returns {Promise.<string>} - A Promise that is fulfilled when this function has completed, or rejected if an error was raised. Resolved with token or rejected with error.
     */
    UserAgentApplication.prototype.acquireTokenSilent = function (scopes, authority, user, extraQueryParameters) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var isValidScope = _this.validateInputScope(scopes);
            if (isValidScope && !Utils_1.Utils.isEmpty(isValidScope)) {
                reject(Constants_1.ErrorCodes.inputScopesError + "|" + isValidScope);
            }
            else {
                if (scopes) {
                    scopes = _this.filterScopes(scopes);
                }
                var scope_1 = scopes.join(" ").toLowerCase();
                var userObject_1 = user ? user : _this.getUser();
                if (!userObject_1) {
                    reject(Constants_1.ErrorCodes.userLoginError + "|" + Constants_1.ErrorDescription.userLoginError);
                    return;
                }
                var authenticationRequest_1;
                var newAuthority = authority ? AuthorityFactory_1.AuthorityFactory.CreateInstance(authority, _this.validateAuthority) : _this.authorityInstance;
                if (Utils_1.Utils.compareObjects(userObject_1, _this.getUser())) {
                    if (scopes.indexOf(_this.clientId) > -1) {
                        authenticationRequest_1 = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(newAuthority, _this.clientId, scopes, ResponseTypes.id_token, _this._redirectUri);
                    }
                    else {
                        authenticationRequest_1 = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(newAuthority, _this.clientId, scopes, ResponseTypes.token, _this._redirectUri);
                    }
                }
                else {
                    authenticationRequest_1 = new AuthenticationRequestParameters_1.AuthenticationRequestParameters(newAuthority, _this.clientId, scopes, ResponseTypes.id_token_token, _this._redirectUri);
                }
                var cacheResult = _this.getCachedToken(authenticationRequest_1, userObject_1);
                if (cacheResult) {
                    if (cacheResult.token) {
                        _this._logger.info("Token is already in cache for scope:" + scope_1);
                        resolve(cacheResult.token);
                        return;
                    }
                    else if (cacheResult.errorDesc || cacheResult.error) {
                        _this._logger.infoPii(cacheResult.errorDesc + ":" + cacheResult.error);
                        reject(cacheResult.errorDesc + "|" + cacheResult.error);
                        return;
                    }
                }
                // cache miss
                return _this.authorityInstance.ResolveEndpointsAsync()
                    .then(function () {
                    // refresh attept with iframe
                    //Already renewing for this scope, callback when we get the token.
                    if (window.activeRenewals[scope_1]) {
                        _this._logger.verbose("Renew token for scope: " + scope_1 + " is in progress. Registering callback");
                        //Active renewals contains the state for each renewal.
                        _this.registerCallback(window.activeRenewals[scope_1], scope_1, resolve, reject);
                    }
                    else {
                        if (scopes && scopes.indexOf(_this.clientId) > -1 && scopes.length === 1) {
                            // App uses idToken to send to api endpoints
                            // Default scope is tracked as clientId to store this token
                            _this._logger.verbose("renewing idToken");
                            _this.renewIdToken(scopes, resolve, reject, userObject_1, authenticationRequest_1, extraQueryParameters);
                        }
                        else {
                            _this._logger.verbose("renewing accesstoken");
                            _this.renewToken(scopes, resolve, reject, userObject_1, authenticationRequest_1, extraQueryParameters);
                        }
                    }
                });
            }
        });
    };
    /*
     * Calling _loadFrame but with a timeout to signal failure in loadframeStatus. Callbacks are left.
     * registered when network errors occur and subsequent token requests for same resource are registered to the pending request.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.loadIframeTimeout = function (urlNavigate, frameName, scope) {
        var _this = this;
        //set iframe session to pending
        var expectedState = window.activeRenewals[scope];
        this._logger.verbose("Set loading state to pending for: " + scope + ":" + expectedState);
        this._cacheStorage.setItem(Constants_1.Constants.renewStatus + expectedState, Constants_1.Constants.tokenRenewStatusInProgress);
        this.loadFrame(urlNavigate, frameName);
        setTimeout(function () {
            if (_this._cacheStorage.getItem(Constants_1.Constants.renewStatus + expectedState) === Constants_1.Constants.tokenRenewStatusInProgress) {
                // fail the iframe session if it"s in pending state
                _this._logger.verbose("Loading frame has timed out after: " + (_this.loadFrameTimeout / 1000) + " seconds for scope " + scope + ":" + expectedState);
                if (expectedState && window.callBackMappedToRenewStates[expectedState]) {
                    window.callBackMappedToRenewStates[expectedState]("Token renewal operation failed due to timeout", null, "Token Renewal Failed", Constants_1.Constants.accessToken);
                }
                _this._cacheStorage.setItem(Constants_1.Constants.renewStatus + expectedState, Constants_1.Constants.tokenRenewStatusCancelled);
            }
        }, this.loadFrameTimeout);
    };
    /*
     * Loads iframe with authorization endpoint URL
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.loadFrame = function (urlNavigate, frameName) {
        var _this = this;
        // This trick overcomes iframe navigation in IE
        // IE does not load the page consistently in iframe
        this._logger.info("LoadFrame: " + frameName);
        var frameCheck = frameName;
        setTimeout(function () {
            var frameHandle = _this.addAdalFrame(frameCheck);
            if (frameHandle.src === "" || frameHandle.src === "about:blank") {
                frameHandle.src = urlNavigate;
                _this._logger.infoPii("Frame Name : " + frameName + " Navigated to: " + urlNavigate);
            }
        }, 500);
    };
    /*
     * Adds the hidden iframe for silent token renewal.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.addAdalFrame = function (iframeId) {
        if (typeof iframeId === "undefined") {
            return null;
        }
        this._logger.info("Add msal frame to document:" + iframeId);
        var adalFrame = document.getElementById(iframeId);
        if (!adalFrame) {
            if (document.createElement &&
                document.documentElement &&
                (window.navigator.userAgent.indexOf("MSIE 5.0") === -1)) {
                var ifr = document.createElement("iframe");
                ifr.setAttribute("id", iframeId);
                ifr.style.visibility = "hidden";
                ifr.style.position = "absolute";
                ifr.style.width = ifr.style.height = "0";
                ifr.style.border = "0";
                adalFrame = document.getElementsByTagName("body")[0].appendChild(ifr);
            }
            else if (document.body && document.body.insertAdjacentHTML) {
                document.body.insertAdjacentHTML('beforeend', '<iframe name="' + iframeId + '" id="' + iframeId + '" style="display:none"></iframe>');
            }
            if (window.frames && window.frames[iframeId]) {
                adalFrame = window.frames[iframeId];
            }
        }
        return adalFrame;
    };
    /*
     * Acquires access token using a hidden iframe.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.renewToken = function (scopes, resolve, reject, user, authenticationRequest, extraQueryParameters) {
        var scope = scopes.join(" ").toLowerCase();
        this._logger.verbose("renewToken is called for scope:" + scope);
        var frameHandle = this.addAdalFrame("msalRenewFrame" + scope);
        if (extraQueryParameters) {
            authenticationRequest.extraQueryParameters = extraQueryParameters;
        }
        var acquireTokenUserKey = Constants_1.Constants.acquireTokenUser + Constants_1.Constants.resourceDelimeter + user.userIdentifier + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
        if (Utils_1.Utils.isEmpty(this._cacheStorage.getItem(acquireTokenUserKey))) {
            this._cacheStorage.setItem(acquireTokenUserKey, JSON.stringify(user));
        }
        var authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
        if (Utils_1.Utils.isEmpty(this._cacheStorage.getItem(authorityKey))) {
            this._cacheStorage.setItem(authorityKey, authenticationRequest.authority);
        }
        // renew happens in iframe, so it keeps javascript context
        this._cacheStorage.setItem(Constants_1.Constants.nonceIdToken, authenticationRequest.nonce);
        this._logger.verbose("Renew token Expected state: " + authenticationRequest.state);
        var urlNavigate = authenticationRequest.createNavigateUrl(scopes) + "&prompt=none";
        urlNavigate = this.addHintParameters(urlNavigate, user);
        window.renewStates.push(authenticationRequest.state);
        window.requestType = Constants_1.Constants.renewToken;
        this.registerCallback(authenticationRequest.state, scope, resolve, reject);
        this._logger.infoPii("Navigate to:" + urlNavigate);
        frameHandle.src = "about:blank";
        this.loadIframeTimeout(urlNavigate, "msalRenewFrame" + scope, scope);
    };
    /*
     * Renews idtoken for app"s own backend when clientId is passed as a single scope in the scopes array.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.renewIdToken = function (scopes, resolve, reject, user, authenticationRequest, extraQueryParameters) {
        var scope = scopes.join(" ").toLowerCase();
        this._logger.info("renewidToken is called");
        var frameHandle = this.addAdalFrame("msalIdTokenFrame");
        if (extraQueryParameters) {
            authenticationRequest.extraQueryParameters = extraQueryParameters;
        }
        var acquireTokenUserKey = Constants_1.Constants.acquireTokenUser + Constants_1.Constants.resourceDelimeter + user.userIdentifier + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
        if (Utils_1.Utils.isEmpty(this._cacheStorage.getItem(acquireTokenUserKey))) {
            this._cacheStorage.setItem(acquireTokenUserKey, JSON.stringify(user));
        }
        var authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + authenticationRequest.state;
        if (Utils_1.Utils.isEmpty(this._cacheStorage.getItem(authorityKey))) {
            this._cacheStorage.setItem(authorityKey, authenticationRequest.authority);
        }
        this._cacheStorage.setItem(Constants_1.Constants.nonceIdToken, authenticationRequest.nonce);
        this._logger.verbose("Renew Idtoken Expected state: " + authenticationRequest.state);
        var urlNavigate = authenticationRequest.createNavigateUrl(scopes) + "&prompt=none";
        urlNavigate = this.addHintParameters(urlNavigate, user);
        window.renewStates.push(authenticationRequest.state);
        window.requestType = Constants_1.Constants.renewToken;
        this.registerCallback(authenticationRequest.state, this.clientId, resolve, reject);
        this._logger.infoPii("Navigate to:" + urlNavigate);
        frameHandle.src = "about:blank";
        this.loadIframeTimeout(urlNavigate, "msalIdTokenFrame", this.clientId);
    };
    /*
      * Returns the signed in user (received from a user object created at the time of login) or null.
      */
    UserAgentApplication.prototype.getUser = function () {
        // idToken is first call
        if (this._user) {
            return this._user;
        }
        // frame is used to get idToken
        var rawIdToken = this._cacheStorage.getItem(Constants_1.Constants.idTokenKey);
        var rawClientInfo = this._cacheStorage.getItem(Constants_1.Constants.msalClientInfo);
        if (!Utils_1.Utils.isEmpty(rawIdToken) && !Utils_1.Utils.isEmpty(rawClientInfo)) {
            var idToken = new IdToken_1.IdToken(rawIdToken);
            var clientInfo = new ClientInfo_1.ClientInfo(rawClientInfo);
            this._user = User_1.User.createUser(idToken, clientInfo, this.authority);
            return this._user;
        }
        return null;
    };
    /*
     * This method must be called for processing the response received from the STS. It extracts the hash, processes the token or error information and saves it in the cache. It then
     * calls the registered callbacks in case of redirect or resolves the promises with the result.
     * @param {string} [hash=window.location.hash] - Hash fragment of Url.
     * @hidden
     */
    UserAgentApplication.prototype.handleAuthenticationResponse = function (hash) {
        if (hash == null) {
            hash = window.location.hash;
        }
        var self = null;
        var isPopup = false;
        var isWindowOpenerMsal = false;
        try {
            isWindowOpenerMsal = window.opener && window.opener.msal && window.opener.msal !== window.msal;
        }
        catch (err) {
            // err = SecurityError: Blocked a frame with origin "[url]" from accessing a cross-origin frame.
            isWindowOpenerMsal = false;
        }
        if (isWindowOpenerMsal) {
            self = window.opener.msal;
            isPopup = true;
        }
        else if (window.parent && window.parent.msal) {
            self = window.parent.msal;
        }
        var requestInfo = self.getRequestInfo(hash); //if(window.parent!==window), by using self, window.parent becomes equal to window in getRequestInfo method specifically
        var token = null, tokenReceivedCallback = null, tokenType, saveToken = true;
        self._logger.info("Returned from redirect url");
        if (window.parent !== window && window.parent.msal) {
            tokenReceivedCallback = window.parent.callBackMappedToRenewStates[requestInfo.stateResponse];
        }
        else if (window.opener && window.opener.msal) {
            tokenReceivedCallback = window.opener.callBackMappedToRenewStates[requestInfo.stateResponse];
        }
        else {
            if (self._navigateToLoginRequestUrl) {
                tokenReceivedCallback = null;
                self._cacheStorage.setItem(Constants_1.Constants.urlHash, hash);
                saveToken = false;
                if (window.parent === window && !isPopup) {
                    window.location.href = self._cacheStorage.getItem(Constants_1.Constants.loginRequest);
                }
                return;
            }
            else {
                tokenReceivedCallback = self._tokenReceivedCallback;
                window.location.hash = '';
            }
        }
        self.saveTokenFromHash(requestInfo);
        if ((requestInfo.requestType === Constants_1.Constants.renewToken) && window.parent) {
            if (window.parent !== window) {
                self._logger.verbose("Window is in iframe, acquiring token silently");
            }
            else {
                self._logger.verbose("acquiring token interactive in progress");
            }
            token = requestInfo.parameters[Constants_1.Constants.accessToken] || requestInfo.parameters[Constants_1.Constants.idToken];
            tokenType = Constants_1.Constants.accessToken;
        }
        else if (requestInfo.requestType === Constants_1.Constants.login) {
            token = requestInfo.parameters[Constants_1.Constants.idToken];
            tokenType = Constants_1.Constants.idToken;
        }
        var errorDesc = requestInfo.parameters[Constants_1.Constants.errorDescription];
        var error = requestInfo.parameters[Constants_1.Constants.error];
        try {
            if (tokenReceivedCallback) {
                tokenReceivedCallback.call(self, errorDesc, token, error, tokenType);
            }
        }
        catch (err) {
            self._logger.error("Error occurred in token received callback function: " + err);
        }
        for (var i = 0; i < window.openedWindows.length; i++) {
            window.openedWindows[i].close();
        }
    };
    /*
     * This method must be called for processing the response received from AAD. It extracts the hash, processes the token or error, saves it in the cache and calls the registered callbacks with the result.
     * @param {string} authority authority received in the redirect response from AAD.
     * @param {TokenResponse} requestInfo an object created from the redirect response from AAD comprising of the keys - parameters, requestType, stateMatch, stateResponse and valid.
     * @param {User} user user object for which scopes are consented for. The default user is the logged in user.
     * @param {ClientInfo} clientInfo clientInfo received as part of the response comprising of fields uid and utid.
     * @param {IdToken} idToken idToken received as part of the response.
     * @ignore
     * @private
     * @hidden
     */
    UserAgentApplication.prototype.saveAccessToken = function (authority, tokenResponse, user, clientInfo, idToken) {
        var scope;
        var clientObj = new ClientInfo_1.ClientInfo(clientInfo);
        if (tokenResponse.parameters.hasOwnProperty("scope")) {
            scope = tokenResponse.parameters["scope"];
            var consentedScopes = scope.split(" ");
            var accessTokenCacheItems = this._cacheStorage.getAllAccessTokens(this.clientId, authority);
            for (var i = 0; i < accessTokenCacheItems.length; i++) {
                var accessTokenCacheItem = accessTokenCacheItems[i];
                if (accessTokenCacheItem.key.userIdentifier === user.userIdentifier) {
                    var cachedScopes = accessTokenCacheItem.key.scopes.split(" ");
                    if (Utils_1.Utils.isIntersectingScopes(cachedScopes, consentedScopes)) {
                        this._cacheStorage.removeItem(JSON.stringify(accessTokenCacheItem.key));
                    }
                }
            }
            var accessTokenKey = new AccessTokenKey_1.AccessTokenKey(authority, this.clientId, scope, clientObj.uid, clientObj.utid);
            var accessTokenValue = new AccessTokenValue_1.AccessTokenValue(tokenResponse.parameters[Constants_1.Constants.accessToken], idToken.rawIdToken, Utils_1.Utils.expiresIn(tokenResponse.parameters[Constants_1.Constants.expiresIn]).toString(), clientInfo);
            this._cacheStorage.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        }
        else {
            scope = this.clientId;
            var accessTokenKey = new AccessTokenKey_1.AccessTokenKey(authority, this.clientId, scope, clientObj.uid, clientObj.utid);
            var accessTokenValue = new AccessTokenValue_1.AccessTokenValue(tokenResponse.parameters[Constants_1.Constants.idToken], tokenResponse.parameters[Constants_1.Constants.idToken], idToken.expiration, clientInfo);
            this._cacheStorage.setItem(JSON.stringify(accessTokenKey), JSON.stringify(accessTokenValue));
        }
    };
    /*
     * Saves token or error received in the response from AAD in the cache. In case of id_token, it also creates the user object.
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.saveTokenFromHash = function (tokenResponse) {
        this._logger.info("State status:" + tokenResponse.stateMatch + "; Request type:" + tokenResponse.requestType);
        this._cacheStorage.setItem(Constants_1.Constants.msalError, "");
        this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, "");
        var scope = "";
        var authorityKey = "";
        var acquireTokenUserKey = "";
        if (tokenResponse.parameters.hasOwnProperty("scope")) {
            scope = tokenResponse.parameters["scope"].toLowerCase();
        }
        else {
            scope = this.clientId;
        }
        // Record error
        if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.errorDescription) || tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.error)) {
            this._logger.infoPii("Error :" + tokenResponse.parameters[Constants_1.Constants.error] + "; Error description:" + tokenResponse.parameters[Constants_1.Constants.errorDescription]);
            this._cacheStorage.setItem(Constants_1.Constants.msalError, tokenResponse.parameters["error"]);
            this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, tokenResponse.parameters[Constants_1.Constants.errorDescription]);
            if (tokenResponse.requestType === Constants_1.Constants.login) {
                this._loginInProgress = false;
                this._cacheStorage.setItem(Constants_1.Constants.loginError, tokenResponse.parameters[Constants_1.Constants.errorDescription] + ":" + tokenResponse.parameters[Constants_1.Constants.error]);
                authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + tokenResponse.stateResponse;
            }
            if (tokenResponse.requestType === Constants_1.Constants.renewToken) {
                this._acquireTokenInProgress = false;
                authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + tokenResponse.stateResponse;
                var userKey = this.getUser() !== null ? this.getUser().userIdentifier : "";
                acquireTokenUserKey = Constants_1.Constants.acquireTokenUser + Constants_1.Constants.resourceDelimeter + userKey + Constants_1.Constants.resourceDelimeter + tokenResponse.stateResponse;
            }
        }
        else {
            // It must verify the state from redirect
            if (tokenResponse.stateMatch) {
                // record tokens to storage if exists
                this._logger.info("State is right");
                if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.sessionState)) {
                    this._cacheStorage.setItem(Constants_1.Constants.msalSessionState, tokenResponse.parameters[Constants_1.Constants.sessionState]);
                }
                var idToken;
                var clientInfo = "";
                if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.accessToken)) {
                    this._logger.info("Fragment has access token");
                    this._acquireTokenInProgress = false;
                    var user = void 0;
                    if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.idToken)) {
                        idToken = new IdToken_1.IdToken(tokenResponse.parameters[Constants_1.Constants.idToken]);
                    }
                    else {
                        idToken = new IdToken_1.IdToken(this._cacheStorage.getItem(Constants_1.Constants.idTokenKey));
                    }
                    authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + tokenResponse.stateResponse;
                    var authority = void 0;
                    if (!Utils_1.Utils.isEmpty(this._cacheStorage.getItem(authorityKey))) {
                        authority = this._cacheStorage.getItem(authorityKey);
                        authority = Utils_1.Utils.replaceFirstPath(authority, idToken.tenantId);
                    }
                    if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.clientInfo)) {
                        clientInfo = tokenResponse.parameters[Constants_1.Constants.clientInfo];
                        user = User_1.User.createUser(idToken, new ClientInfo_1.ClientInfo(clientInfo), authority);
                    }
                    else {
                        this._logger.warning("ClientInfo not received in the response from AAD");
                        user = User_1.User.createUser(idToken, new ClientInfo_1.ClientInfo(clientInfo), authority);
                    }
                    acquireTokenUserKey = Constants_1.Constants.acquireTokenUser + Constants_1.Constants.resourceDelimeter + user.userIdentifier + Constants_1.Constants.resourceDelimeter + tokenResponse.stateResponse;
                    var acquireTokenUser = void 0;
                    if (!Utils_1.Utils.isEmpty(this._cacheStorage.getItem(acquireTokenUserKey))) {
                        acquireTokenUser = JSON.parse(this._cacheStorage.getItem(acquireTokenUserKey));
                        if (user && acquireTokenUser && Utils_1.Utils.compareObjects(user, acquireTokenUser)) {
                            this.saveAccessToken(authority, tokenResponse, user, clientInfo, idToken);
                            this._logger.info("The user object received in the response is the same as the one passed in the acquireToken request");
                        }
                        else {
                            this._logger.warning("The user object created from the response is not the same as the one passed in the acquireToken request");
                        }
                    }
                }
                if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.idToken)) {
                    if (scope.indexOf(this.clientId) > -1) {
                        this._logger.info("Fragment has id token");
                        this._loginInProgress = false;
                        idToken = new IdToken_1.IdToken(tokenResponse.parameters[Constants_1.Constants.idToken]);
                        if (tokenResponse.parameters.hasOwnProperty(Constants_1.Constants.clientInfo)) {
                            clientInfo = tokenResponse.parameters[Constants_1.Constants.clientInfo];
                        }
                        else {
                            this._logger.warning("ClientInfo not received in the response from AAD");
                        }
                        authorityKey = Constants_1.Constants.authority + Constants_1.Constants.resourceDelimeter + tokenResponse.stateResponse;
                        var authority = void 0;
                        if (!Utils_1.Utils.isEmpty(this._cacheStorage.getItem(authorityKey))) {
                            authority = this._cacheStorage.getItem(authorityKey);
                            authority = Utils_1.Utils.replaceFirstPath(authority, idToken.tenantId);
                        }
                        this._user = User_1.User.createUser(idToken, new ClientInfo_1.ClientInfo(clientInfo), authority);
                        if (idToken && idToken.nonce) {
                            if (idToken.nonce !== this._cacheStorage.getItem(Constants_1.Constants.nonceIdToken)) {
                                this._user = null;
                                this._cacheStorage.setItem(Constants_1.Constants.loginError, "Nonce Mismatch. Expected Nonce: " + this._cacheStorage.getItem(Constants_1.Constants.nonceIdToken) + "," + "Actual Nonce: " + idToken.nonce);
                                this._logger.error("Nonce Mismatch.Expected Nonce: " + this._cacheStorage.getItem(Constants_1.Constants.nonceIdToken) + "," + "Actual Nonce: " + idToken.nonce);
                            }
                            else {
                                this._cacheStorage.setItem(Constants_1.Constants.idTokenKey, tokenResponse.parameters[Constants_1.Constants.idToken]);
                                this._cacheStorage.setItem(Constants_1.Constants.msalClientInfo, clientInfo);
                                // Save idToken as access token for app itself
                                this.saveAccessToken(authority, tokenResponse, this._user, clientInfo, idToken);
                            }
                        }
                        else {
                            this._logger.error("Invalid id_token received in the response");
                            this._cacheStorage.setItem(Constants_1.Constants.msalError, "invalid idToken");
                            this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, "Invalid idToken. idToken: " + tokenResponse.parameters[Constants_1.Constants.idToken]);
                        }
                    }
                }
            }
            else {
                this._logger.error("State Mismatch.Expected State: " + this._cacheStorage.getItem(Constants_1.Constants.stateLogin) + "," + "Actual State: " + tokenResponse.stateResponse);
                this._cacheStorage.setItem(Constants_1.Constants.msalError, "Invalid_state");
                this._cacheStorage.setItem(Constants_1.Constants.msalErrorDescription, "Invalid_state. state: " + tokenResponse.stateResponse);
            }
        }
        this._cacheStorage.setItem(Constants_1.Constants.renewStatus + tokenResponse.stateResponse, Constants_1.Constants.tokenRenewStatusCompleted);
        this._cacheStorage.removeAcquireTokenEntries(authorityKey, acquireTokenUserKey);
    };
    /*
     * Checks if the redirect response is received from the STS. In case of redirect, the url fragment has either id_token, access_token or error.
     * @param {string} hash - Hash passed from redirect page.
     * @returns {Boolean} - true if response contains id_token, access_token or error, false otherwise.
     * @hidden
     */
    UserAgentApplication.prototype.isCallback = function (hash) {
        hash = this.getHash(hash);
        var parameters = Utils_1.Utils.deserialize(hash);
        return (parameters.hasOwnProperty(Constants_1.Constants.errorDescription) ||
            parameters.hasOwnProperty(Constants_1.Constants.error) ||
            parameters.hasOwnProperty(Constants_1.Constants.accessToken) ||
            parameters.hasOwnProperty(Constants_1.Constants.idToken));
    };
    /*
     * Returns the anchor part(#) of the URL
     * @ignore
     * @hidden
     */
    UserAgentApplication.prototype.getHash = function (hash) {
        if (hash.indexOf("#/") > -1) {
            hash = hash.substring(hash.indexOf("#/") + 2);
        }
        else if (hash.indexOf("#") > -1) {
            hash = hash.substring(1);
        }
        return hash;
    };
    /*
      * Creates a requestInfo object from the URL fragment and returns it.
      * @param {string} hash  -  Hash passed from redirect page
      * @returns {TokenResponse} an object created from the redirect response from AAD comprising of the keys - parameters, requestType, stateMatch, stateResponse and valid.
      * @ignore
      * @hidden
      */
    UserAgentApplication.prototype.getRequestInfo = function (hash) {
        hash = this.getHash(hash);
        var parameters = Utils_1.Utils.deserialize(hash);
        var tokenResponse = new RequestInfo_1.TokenResponse();
        if (parameters) {
            tokenResponse.parameters = parameters;
            if (parameters.hasOwnProperty(Constants_1.Constants.errorDescription) ||
                parameters.hasOwnProperty(Constants_1.Constants.error) ||
                parameters.hasOwnProperty(Constants_1.Constants.accessToken) ||
                parameters.hasOwnProperty(Constants_1.Constants.idToken)) {
                tokenResponse.valid = true;
                // which call
                var stateResponse = void 0;
                if (parameters.hasOwnProperty("state")) {
                    stateResponse = parameters.state;
                }
                else {
                    return tokenResponse;
                }
                tokenResponse.stateResponse = stateResponse;
                // async calls can fire iframe and login request at the same time if developer does not use the API as expected
                // incoming callback needs to be looked up to find the request type
                if (stateResponse === this._cacheStorage.getItem(Constants_1.Constants.stateLogin)) {
                    tokenResponse.requestType = Constants_1.Constants.login;
                    tokenResponse.stateMatch = true;
                    return tokenResponse;
                }
                else if (stateResponse === this._cacheStorage.getItem(Constants_1.Constants.stateAcquireToken)) {
                    tokenResponse.requestType = Constants_1.Constants.renewToken;
                    tokenResponse.stateMatch = true;
                    return tokenResponse;
                }
                // external api requests may have many renewtoken requests for different resource
                if (!tokenResponse.stateMatch) {
                    tokenResponse.requestType = window.requestType;
                    var statesInParentContext = window.renewStates;
                    for (var i = 0; i < statesInParentContext.length; i++) {
                        if (statesInParentContext[i] === tokenResponse.stateResponse) {
                            tokenResponse.stateMatch = true;
                            break;
                        }
                    }
                }
            }
        }
        return tokenResponse;
    };
    /*
      * Extracts scope value from the state sent with the authentication request.
      * @returns {string} scope.
      * @ignore
      * @hidden
      */
    UserAgentApplication.prototype.getScopeFromState = function (state) {
        if (state) {
            var splitIndex = state.indexOf("|");
            if (splitIndex > -1 && splitIndex + 1 < state.length) {
                return state.substring(splitIndex + 1);
            }
        }
        return "";
    };
    /*
      * Returns whether current window is in ifram for token renewal
      * @ignore
      * @hidden
      */
    UserAgentApplication.prototype.isInIframe = function () {
        return window.parent !== window;
    };
    UserAgentApplication.prototype.loginInProgress = function () {
        var pendingCallback = this._cacheStorage.getItem(Constants_1.Constants.urlHash);
        if (pendingCallback)
            return true;
        return this._loginInProgress;
    };
    UserAgentApplication.prototype.getHostFromUri = function (uri) {
        // remove http:// or https:// from uri
        var extractedUri = String(uri).replace(/^(https?:)\/\//, '');
        extractedUri = extractedUri.split('/')[0];
        return extractedUri;
    };
    UserAgentApplication.prototype.getScopesForEndpoint = function (endpoint) {
        // if user specified list of anonymous endpoints, no need to send token to these endpoints, return null.
        if (this._anonymousEndpoints.length > 0) {
            for (var i = 0; i < this._anonymousEndpoints.length; i++) {
                if (endpoint.indexOf(this._anonymousEndpoints[i]) > -1) {
                    return null;
                }
            }
        }
        if (this._endpoints.size > 0) {
            for (var _i = 0, _a = Array.from(this._endpoints.keys()); _i < _a.length; _i++) {
                var key = _a[_i];
                // configEndpoint is like /api/Todo requested endpoint can be /api/Todo/1
                if (endpoint.indexOf(key) > -1) {
                    return this._endpoints.get(key);
                }
            }
        }
        // default resource will be clientid if nothing specified
        // App will use idtoken for calls to itself
        // check if it's staring from http or https, needs to match with app host
        if (endpoint.indexOf('http://') > -1 || endpoint.indexOf('https://') > -1) {
            if (this.getHostFromUri(endpoint) === this.getHostFromUri(this._redirectUri)) {
                return new Array(this.clientId);
            }
        }
        else {
            // in angular level, the url for $http interceptor call could be relative url,
            // if it's relative call, we'll treat it as app backend call.            
            return new Array(this.clientId);
        }
        // if not the app's own backend or not a domain listed in the endpoints structure
        return null;
    };
    tslib_1.__decorate([
        resolveTokenOnlyIfOutOfIframe
    ], UserAgentApplication.prototype, "acquireTokenSilent", null);
    return UserAgentApplication;
}());
exports.UserAgentApplication = UserAgentApplication;
//# sourceMappingURL=UserAgentApplication.js.map