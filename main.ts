import {
	App,
	Editor,
	editorInfoField,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

interface CodeBlockInserterSettings {
	lastUsedLanguage: string;
	additionalLanguages: string;
}

const DEFAULT_SETTINGS: CodeBlockInserterSettings = {
	lastUsedLanguage: "",
	additionalLanguages: "",
};

export default class CodeBlockInserterPlugin extends Plugin {
	suggester: LanguageSuggester;
	settings: CodeBlockInserterSettings;

	async onload() {
		await this.loadSettings();

		//Init and register LanguageSuggester

		this.suggester = new LanguageSuggester(this);
		this.registerEditorSuggest(this.suggester);

		this.addCommand({
			id: "insert-code-block-custom",
			name: "Insert Code Block (Custom)",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const cursor = editor.getCursor();
				editor.replaceRange("```\n\n```", cursor);
				editor.setCursor({
					line: cursor.line,
					ch: cursor.ch + 3,
				});
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "C",
				},
			],
		});
		this.addSettingTab(new CodeBlockInserterSettingTab(this.app, this));
	}
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class LanguageSuggester extends EditorSuggest<string> {
	plugin: CodeBlockInserterPlugin;
	languages: string[];

	constructor(plugin: CodeBlockInserterPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.languages = [];
		this.updateLanguages();
	}
	updateLanguages() {
		const baseLanguages = [
			"javascript",
			"python",
			"java",
			"c",
			"cpp",
			"csharp",
			"ruby",
			"go",
			"rust",
			"swift",
			"kotlin",
			"php",
			"html",
			"css",
			"sql",
			"bash",
			"powershell",
			"markdown",
			"json",
			"yaml",
			"xml",
			"typescript",
			"ocaml",
		];

		const additionalLanguages = this.plugin.settings.additionalLanguages
			.split(",")
			.map((lang) => lang.trim())
			.filter((lang) => lang.length > 0);

		this.languages = Array.from(
			new Set([...additionalLanguages, ...baseLanguages]),
		);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const match = line.match(/```(\w*)$/);

		if (match) {
			return {
				start: { line: cursor.line, ch: cursor.ch - match[1].length },
				end: cursor,
				query: match[1],
			};
		}
		return null;
	}

	getSuggestions(
		context: EditorSuggestContext,
	): string[] | Promise<string[]> {
		const query = context.query.toLowerCase();
		let suggestions = this.languages.filter((lang) =>
			lang.startsWith(query),
		);
		// Prioritize last used language

		const lastUsedLanguage = this.plugin.settings.lastUsedLanguage;
		if (
			lastUsedLanguage &&
			lastUsedLanguage.startsWith(query) &&
			suggestions.includes(lastUsedLanguage)
		) {
			// move to top
			suggestions = [
				lastUsedLanguage,
				...suggestions.filter((lang) => lang !== lastUsedLanguage),
			];
		}

		return suggestions;
	}

	renderSuggestion(lang: string, el: HTMLElement): void {
		el.setText(lang);
	}

	selectSuggestion(lang: string, evt: MouseEvent | KeyboardEvent): void {
		const { editor, start, end } = this.context!;
		editor.replaceRange(lang, start, end);

		// update last used language
		this.plugin.settings.lastUsedLanguage = lang;
		this.plugin.saveSettings();

		// editor.setCursor(end.line, start.ch + lang.length);
		const newCursorPos = {
			line: end.line + 1,
			ch: 0,
		};
		editor.setCursor(newCursorPos);
	}
}

class CodeBlockInserterSettingTab extends PluginSettingTab {
	plugin: CodeBlockInserterPlugin;

	constructor(app: App, plugin: CodeBlockInserterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Last Used Language")
			.setDesc("The last programming language you used in a code block.")
			.addText((text) =>
				text
					.setPlaceholder("No language selected yet")
					.setValue(this.plugin.settings.lastUsedLanguage)
					.onChange(async (value) => {
						this.plugin.settings.lastUsedLanguage = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Additional Languages")
			.setDesc("Add more languages (comma-separated).")
			.addTextArea((text) =>
				text
					.setPlaceholder("e.g., ruby, lang1, lang2")
					.setValue(this.plugin.settings.additionalLanguages)
					.onChange(async (value) => {
						this.plugin.settings.additionalLanguages = value;
						await this.plugin.saveSettings();

						// Update the languages in the suggester
						this.plugin.suggester.updateLanguages();
					}),
			);

		new Setting(containerEl)
			.setName("Reset Last Used Language")
			.setDesc("Clear the last used language.")
			.addButton((button) =>
				button.setButtonText("Reset").onClick(async () => {
					this.plugin.settings.lastUsedLanguage = "";
					await this.plugin.saveSettings();
					this.display();
				}),
			);
	}
}
