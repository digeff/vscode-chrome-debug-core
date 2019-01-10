import { Script } from 'vm';

export class InlineSourcesTS {
    private readonly fileTitle = 'inline-sources-ts';
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
        console.log(`Button from ${this.title} was clicked message 1`);
        console.log(`Button from ${this.title} was clicked message 2`);
        console.log(`Button from ${this.title} was clicked message 3`);
        console.log(`Button from ${this.title} was clicked message 4`);
    }
}

new InlineSourcesTS().addButton();    
