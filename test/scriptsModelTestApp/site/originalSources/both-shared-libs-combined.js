define("shared-ts-lib", ["require", "exports"], function (require, exports) {
    "use strict";
    exports.__esModule = true;
    var SharedLibTS = /** @class */ (function () {
        function SharedLibTS() {
            this.fileTitle = 'shared-ts-lib';
            this.currentScriptURL = this.getCurrentScriptURL();
            this.title = this.fileTitle + " at " + this.currentScriptURL;
            this.buttonsArea = document.getElementById('buttons');
        }
        SharedLibTS.prototype.getCurrentScript = function () {
            var allScripts = document.getElementsByTagName('script');
            return allScripts[allScripts.length - 1];
        };
        SharedLibTS.prototype.getCurrentScriptURL = function () {
            return this.getCurrentScript().src;
        };
        SharedLibTS.prototype.addButton = function () {
            var _this = this;
            var newButton = document.createElement('input');
            newButton.type = 'button';
            newButton.value = this.title;
            newButton.onclick = function () { return _this.onButtonClicked(); };
            this.buttonsArea.appendChild(newButton);
            this.buttonsArea.appendChild(document.createElement('br'));
        };
        SharedLibTS.prototype.onButtonClicked = function () {
            console.log("Button from " + this.title + " was clicked message 1");
            console.log("Button from " + this.title + " was clicked message 2");
            console.log("Button from " + this.title + " was clicked message 3");
            console.log("Button from " + this.title + " was clicked message 4");
        };
        return SharedLibTS;
    }());
    exports.SharedLibTS = SharedLibTS;
    new SharedLibTS().addButton();
});
(function () {
    var fileTitle = 'shared-js-lib';
    function getCurrentScript() {
        var allScripts = document.getElementsByTagName('script');
        return allScripts[allScripts.length - 1];
    }
    function getCurrentScriptURL() {
        return getCurrentScript().src;
    }
    var currentScriptURL = getCurrentScriptURL();
    var title = fileTitle + " at " + currentScriptURL;
    function addButton() {
        var newButton = document.createElement("input");
        newButton.type = 'button';
        newButton.value = title;
        newButton.onclick = onButtonClicked;
        document.getElementById("buttons").appendChild(newButton);
        document.getElementById("buttons").appendChild(document.createElement('br'));
    }
    function onButtonClicked() {
        console.log("Button from " + title + " was clicked message 1");
        console.log("Button from " + title + " was clicked message 2");
        console.log("Button from " + title + " was clicked message 3");
        console.log("Button from " + title + " was clicked message 4");
    }
    addButton();
})();
var define;
define(["shared-ts-lib"], function (sharedTsLib) { });
//# sourceMappingURL=both-shared-libs-combined.js.map