# angular-load-dynamic-components

## JSON Schema form component generator

This repository now includes a NestJS-based CLI utility that converts a JSON Schema description of a form into an Angular component written with Angular Material controls. The generator creates two files: `result.component.ts` and `result.component.html`.

### Usage

1. Install dependencies:

   ```bash
   npm install
   ```

2. Provide a JSON Schema file (an example is available at `src/schema-generator/example.schema.json`).

3. Run the generator, passing the schema path and an optional output directory:

   ```bash
   npm run schema:generate -- src/schema-generator/example.schema.json src/app/generated
   ```

   The command above will create `result.component.ts` and `result.component.html` inside `src/app/generated`.

Both generated files are ready to be integrated into an Angular module that imports the necessary Angular Material and ReactiveForms modules.