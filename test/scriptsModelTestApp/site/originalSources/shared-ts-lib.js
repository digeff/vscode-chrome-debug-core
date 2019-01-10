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
    var title = fileTitle + ' at ' + currentScriptURL;
    function addButton() {
        var newButton = document.createElement('input');
        newButton.type = 'button';
        newButton.value = title;
        newButton.onclick = onButtonClicked;
        document.getElementById('buttons').appendChild(newButton);
        document.getElementById('buttons').appendChild(document.createElement('br'));
    }
    function onButtonClicked() {
        console.log('Button from ' + title + ' was clicked message 1');
        console.log('Button from ' + title + ' was clicked message 2');
        console.log('Button from ' + title + ' was clicked message 3');
        console.log('Button from ' + title + ' was clicked message 4');
    }
    addButton();
})();
//# sourceMappingURL=shared-ts-lib.js.map