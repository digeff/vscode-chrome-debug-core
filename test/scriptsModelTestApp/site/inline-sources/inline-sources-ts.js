"use strict";
exports.__esModule = true;
var InlineSourcesTS = /** @class */ (function () {
    function InlineSourcesTS() {
        this.fileTitle = 'inline-sources-ts';
        this.currentScriptURL = this.getCurrentScriptURL();
        this.title = this.fileTitle + " at " + this.currentScriptURL;
        this.buttonsArea = document.getElementById('buttons');
    }
    InlineSourcesTS.prototype.getCurrentScript = function () {
        var allScripts = document.getElementsByTagName('script');
        return allScripts[allScripts.length - 1];
    };
    InlineSourcesTS.prototype.getCurrentScriptURL = function () {
        return this.getCurrentScript().src;
    };
    InlineSourcesTS.prototype.addButton = function () {
        var _this = this;
        var newButton = document.createElement('input');
        newButton.type = 'button';
        newButton.value = this.title;
        newButton.onclick = function () { return _this.onButtonClicked(); };
        this.buttonsArea.appendChild(newButton);
        this.buttonsArea.appendChild(document.createElement('br'));
    };
    InlineSourcesTS.prototype.onButtonClicked = function () {
        console.log("Button from " + this.title + " was clicked message 1");
        console.log("Button from " + this.title + " was clicked message 2");
        console.log("Button from " + this.title + " was clicked message 3");
        console.log("Button from " + this.title + " was clicked message 4");
    };
    return InlineSourcesTS;
}());
exports.InlineSourcesTS = InlineSourcesTS;
new InlineSourcesTS().addButton();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLXNvdXJjZXMtdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmxpbmUtc291cmNlcy10cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBO0lBQUE7UUFDcUIsY0FBUyxHQUFHLG1CQUFtQixDQUFDO1FBQ2hDLHFCQUFnQixHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzlDLFVBQUssR0FBTSxJQUFJLENBQUMsU0FBUyxZQUFPLElBQUksQ0FBQyxnQkFBa0IsQ0FBQztRQUN4RCxnQkFBVyxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUM7SUEyQnRFLENBQUM7SUF6QlcsMENBQWdCLEdBQXhCO1FBQ0ksSUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNELE9BQU8sVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVPLDZDQUFtQixHQUEzQjtRQUNJLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDO0lBQ3ZDLENBQUM7SUFFTSxtQ0FBUyxHQUFoQjtRQUFBLGlCQVFDO1FBUEcsSUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNsRCxTQUFTLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQztRQUMxQixTQUFTLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDN0IsU0FBUyxDQUFDLE9BQU8sR0FBRyxjQUFNLE9BQUEsS0FBSSxDQUFDLGVBQWUsRUFBRSxFQUF0QixDQUFzQixDQUFDO1FBRWpELElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRU8seUNBQWUsR0FBdkI7UUFDSSxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFlLElBQUksQ0FBQyxLQUFLLDJCQUF3QixDQUFDLENBQUM7UUFDL0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBZSxJQUFJLENBQUMsS0FBSywyQkFBd0IsQ0FBQyxDQUFDO1FBQy9ELE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWUsSUFBSSxDQUFDLEtBQUssMkJBQXdCLENBQUMsQ0FBQztRQUMvRCxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFlLElBQUksQ0FBQyxLQUFLLDJCQUF3QixDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUNMLHNCQUFDO0FBQUQsQ0FBQyxBQS9CRCxJQStCQztBQS9CWSwwQ0FBZTtBQWlDNUIsSUFBSSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNjcmlwdCB9IGZyb20gJ3ZtJztcclxuXHJcbmV4cG9ydCBjbGFzcyBJbmxpbmVTb3VyY2VzVFMge1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBmaWxlVGl0bGUgPSAnaW5saW5lLXNvdXJjZXMtdHMnO1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBjdXJyZW50U2NyaXB0VVJMID0gdGhpcy5nZXRDdXJyZW50U2NyaXB0VVJMKCk7XHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IHRpdGxlID0gYCR7dGhpcy5maWxlVGl0bGV9IGF0ICR7dGhpcy5jdXJyZW50U2NyaXB0VVJMfWA7XHJcbiAgICBwcml2YXRlIHJlYWRvbmx5IGJ1dHRvbnNBcmVhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J1dHRvbnMnKTtcclxuXHJcbiAgICBwcml2YXRlIGdldEN1cnJlbnRTY3JpcHQoKTogSFRNTFNjcmlwdEVsZW1lbnQge1xyXG4gICAgICAgIGNvbnN0IGFsbFNjcmlwdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0Jyk7XHJcbiAgICAgICAgcmV0dXJuIGFsbFNjcmlwdHNbYWxsU2NyaXB0cy5sZW5ndGggLSAxXTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGdldEN1cnJlbnRTY3JpcHRVUkwoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50U2NyaXB0KCkuc3JjO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhZGRCdXR0b24oKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgbmV3QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgICAgICBuZXdCdXR0b24udHlwZSA9ICdidXR0b24nO1xyXG4gICAgICAgIG5ld0J1dHRvbi52YWx1ZSA9IHRoaXMudGl0bGU7XHJcbiAgICAgICAgbmV3QnV0dG9uLm9uY2xpY2sgPSAoKSA9PiB0aGlzLm9uQnV0dG9uQ2xpY2tlZCgpO1xyXG5cclxuICAgICAgICB0aGlzLmJ1dHRvbnNBcmVhLmFwcGVuZENoaWxkKG5ld0J1dHRvbik7XHJcbiAgICAgICAgdGhpcy5idXR0b25zQXJlYS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uQnV0dG9uQ2xpY2tlZCgpOiB2b2lkIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgQnV0dG9uIGZyb20gJHt0aGlzLnRpdGxlfSB3YXMgY2xpY2tlZCBtZXNzYWdlIDFgKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgQnV0dG9uIGZyb20gJHt0aGlzLnRpdGxlfSB3YXMgY2xpY2tlZCBtZXNzYWdlIDJgKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgQnV0dG9uIGZyb20gJHt0aGlzLnRpdGxlfSB3YXMgY2xpY2tlZCBtZXNzYWdlIDNgKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgQnV0dG9uIGZyb20gJHt0aGlzLnRpdGxlfSB3YXMgY2xpY2tlZCBtZXNzYWdlIDRgKTtcclxuICAgIH1cclxufVxyXG5cclxubmV3IElubGluZVNvdXJjZXNUUygpLmFkZEJ1dHRvbigpOyAgICBcclxuIl19