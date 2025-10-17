import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: Array<string | number | boolean>;
  format?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: JsonSchemaProperty;
}

interface JsonSchema {
  title?: string;
  description?: string;
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

@Injectable()
export class SchemaGeneratorService {
  async run(args: string[]): Promise<void> {
    const [schemaPath, outputDir = '.'] = args;

    if (!schemaPath) {
      throw new Error('Path to the JSON schema file is required.');
    }

    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent) as JsonSchema;

    const componentClassName = 'ResultComponent';
    const componentSelector = 'app-result';

    const required = new Set(schema.required ?? []);
    const properties = schema.properties ?? {};

    const tsContent = this.createComponentTs(componentClassName, componentSelector, properties, required, schema.title);
    const htmlContent = this.createComponentHtml(properties, required, schema.title, schema.description);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, 'result.component.ts'), tsContent, 'utf8');
    await fs.writeFile(path.join(outputDir, 'result.component.html'), htmlContent, 'utf8');
  }

  private createComponentTs(
    className: string,
    selector: string,
    properties: Record<string, JsonSchemaProperty>,
    required: Set<string>,
    schemaTitle?: string,
  ): string {
    const formControls = Object.entries(properties)
      .map(([key, property]) => this.createFormControl(key, property, required))
      .join(',\n    ');

    const controlGetters = Object.keys(properties)
      .map((key) => this.createControlGetter(key))
      .join('\n\n  ');

    const lines: string[] = [
      "import { ChangeDetectionStrategy, Component } from '@angular/core';",
      "import { FormBuilder, Validators } from '@angular/forms';",
      '',
      '@Component({',
      `  selector: '${selector}',`,
      "  templateUrl: './result.component.html',",
      '  changeDetection: ChangeDetectionStrategy.OnPush,',
      '})',
      `export class ${className} {`,
      schemaTitle ? `  readonly title = ${JSON.stringify(schemaTitle)};` : '',
      '  readonly form = this.fb.group({',
      formControls,
      '  });',
      '',
      '  constructor(private readonly fb: FormBuilder) {}',
      '',
      '  submit(): void {',
      '    if (this.form.invalid) {',
      '      this.form.markAllAsTouched();',
      '      return;',
      '    }',
      '',
      '    console.log(this.form.value);',
      '  }',
      controlGetters ? `
  ${controlGetters}
` : '',
      '}',
      '',
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  private createControlGetter(key: string): string {
    const camelKey = this.toCamel(key);
    return `get ${camelKey}Control() {\n    return this.form.get('${key}');\n  }`;
  }

  private createFormControl(key: string, property: JsonSchemaProperty, required: Set<string>): string {
    const validators: string[] = [];
    const valueType = this.resolvePropertyType(property);

    if (required.has(key)) {
      validators.push('Validators.required');
    }

    if (property.type === 'string' || property.format === 'date') {
      if (typeof property.minLength === 'number') {
        validators.push(`Validators.minLength(${property.minLength})`);
      }
      if (typeof property.maxLength === 'number') {
        validators.push(`Validators.maxLength(${property.maxLength})`);
      }
    }

    if (valueType === 'number' || valueType === 'integer') {
      if (typeof property.minimum === 'number') {
        validators.push(`Validators.min(${property.minimum})`);
      }
      if (typeof property.maximum === 'number') {
        validators.push(`Validators.max(${property.maximum})`);
      }
    }

    const defaultValue = this.getDefaultValue(property, valueType);

    const validatorsSnippet = validators.length ? `, [${validators.join(', ')}]` : '';
    return `'${key}': this.fb.control(${defaultValue}${validatorsSnippet})`;
  }

  private resolvePropertyType(property: JsonSchemaProperty): string | undefined {
    if (Array.isArray(property.type)) {
      return property.type[0];
    }
    if (!property.type && property.enum) {
      return typeof property.enum[0];
    }
    return property.type;
  }

  private getDefaultValue(property: JsonSchemaProperty, valueType?: string): string {
    if (property.default !== undefined) {
      return JSON.stringify(property.default);
    }

    switch (valueType) {
      case 'boolean':
        return 'false';
      case 'number':
      case 'integer':
        return 'null';
      case 'array':
        return '[]';
      default:
        return "''";
    }
  }

  private createComponentHtml(
    properties: Record<string, JsonSchemaProperty>,
    required: Set<string>,
    schemaTitle?: string,
    schemaDescription?: string,
  ): string {
    const fieldsMarkup = Object.entries(properties)
      .map(([key, property]) => this.renderField(key, property, required))
      .join('\n\n');

    const lines: string[] = [
      '<form class="result-form" [formGroup]="form" (ngSubmit)="submit()">',
      schemaTitle ? `  <h2>${schemaTitle}</h2>` : '',
      schemaDescription ? `  <p class="form-description">${schemaDescription}</p>` : '',
      fieldsMarkup.split('\n').map((line) => (line ? `  ${line}` : '')).join('\n'),
      '',
      '  <div class="form-actions">',
      '    <button mat-raised-button color="primary" type="submit">Submit</button>',
      '  </div>',
      '</form>',
      '',
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  private renderField(key: string, property: JsonSchemaProperty, required: Set<string>): string {
    const type = this.resolvePropertyType(property);
    const label = property.title ?? this.toTitle(key);
    const description = property.description ? `\n    <mat-hint>${property.description}</mat-hint>` : '';
    const isRequired = required.has(key);

    if (property.enum && property.enum.length) {
      const options = property.enum
        .map((value) => `      <mat-option [value]="${JSON.stringify(value)}">${value}</mat-option>`)
        .join('\n');

      return [
        '<mat-form-field appearance="fill" class="form-field">',
        `  <mat-label>${label}</mat-label>`,
        `  <mat-select formControlName="${key}"${property.type === 'array' ? ' multiple' : ''}>`,
        options,
        '  </mat-select>',
        description,
        isRequired ? this.requiredErrorTemplate(key, label) : '',
        '</mat-form-field>',
      ]
        .filter(Boolean)
        .join('\n');
    }

    switch (type) {
      case 'boolean':
        return [
          '<mat-checkbox class="form-field" formControlName="' + key + '">',
          `  ${label}${isRequired ? ' *' : ''}`,
          '</mat-checkbox>',
        ].join('\n');
      case 'number':
      case 'integer':
        return this.renderInputField(key, label, 'number', isRequired, description);
      case 'string':
        if (property.format === 'date') {
          return this.renderInputField(key, label, 'date', isRequired, description);
        }
        return this.renderInputField(key, label, 'text', isRequired, description);
      case 'array':
        return this.renderInputField(key, label, 'text', isRequired, description, {
          hint: 'Provide values separated by comma',
        });
      default:
        return this.renderInputField(key, label, 'text', isRequired, description);
    }
  }

  private renderInputField(
    key: string,
    label: string,
    type: string,
    required: boolean,
    description: string,
    options: { hint?: string } = {},
  ): string {
    const hint = options.hint ? `\n    <mat-hint>${options.hint}</mat-hint>` : '';

    return [
      '<mat-form-field appearance="fill" class="form-field">',
      `  <mat-label>${label}</mat-label>`,
      `  <input matInput type="${type}" formControlName="${key}"${required ? ' required' : ''}>`,
      description,
      hint,
      required ? this.requiredErrorTemplate(key, label) : '',
      '</mat-form-field>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private requiredErrorTemplate(key: string, label: string): string {
    return `    <mat-error *ngIf="${this.toCamel(key)}Control?.hasError('required')">${label} is required</mat-error>`;
  }

  private toCamel(value: string): string {
    return value
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (match) => match.toLowerCase());
  }

  private toTitle(value: string): string {
    const withSpaces = value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ');
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  }
}
