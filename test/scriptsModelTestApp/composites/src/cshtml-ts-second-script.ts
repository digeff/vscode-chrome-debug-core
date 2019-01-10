













































































































import { Script } from 'vm';

export class SharedLibTS {
    private readonly fileTitle = 'cshtml-ts-second-script';
    private readonly currentScriptURL = this.getCurrentScriptURL();
    private readonly title = `${this.fileTitle} at ${this.currentScriptURL}`;
    private readonly buttonsArea = document.getElementById('buttons');

    private getCurrentScript(): HTMLScriptElement {
        const allScripts = document.getElementsByTagName('script');
        return allScripts[allScripts.length - 1];
    }

    private getCurrentScriptURL(): string {
        return this.getCurrentScript().src;
    }

    public addButton(): void {
        const newButton = document.createElement('input');
        newButton.type = 'button';
        newButton.value = this.title;
        newButton.onclick = () => this.onButtonClicked();

        this.buttonsArea.appendChild(newButton);
        this.buttonsArea.appendChild(document.createElement('br'));
    }

    private onButtonClicked(): void {
        console.log(`Button from ${this.title} was clicked message 0`);
        console.log(`Button from ${this.title} was clicked message 1`);
        console.log(`Button from ${this.title} was clicked message 2`);
        console.log(`Button from ${this.title} was clicked message 3`);
        console.log(`Button from ${this.title} was clicked message 4`);
        console.log(`Button from ${this.title} was clicked message 5`);
        console.log(`Button from ${this.title} was clicked message 6`);
        console.log(`Button from ${this.title} was clicked message 7`);
        console.log(`Button from ${this.title} was clicked message 8`);
        console.log(`Button from ${this.title} was clicked message 9`);
    }
}

new SharedLibTS().addButton();    