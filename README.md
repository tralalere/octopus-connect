# OctopusConnect

This project is compatible with [Angular CLI](https://github.com/angular/angular-cli) version 17

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

If you want to use it with the `npm link`, the parent project cannot compile this package with the `ngcc` command in `postinstall` script.
So, go to `projects/octopus-connect/tsconfig.lib.json` find the key `enableIvy` and set it to `true` but don't forget to reset to false before publishing !

Either you can use `npm run dev` for active a watcher. It will build the for each update. After that, copy the path of the `dist/octopus-connect` folder and paste it into the `package.json` file of the parent project :
```json
// package.json
// ...
"dependencies": {
    // ...
    "octopus-connect": "path-to\\dist\\octopus-connect",
    // ...
}
```

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

## Publish
Don't forget to update the version in :
 - `package.json` 
 - `projects/octopus-connect/package.json` 
 - `readme.md` 
 - `projects/octopus-connect/readme.md` 

```
ng build --configuration production
cd dist/octopus-connect
npm publish
```  
