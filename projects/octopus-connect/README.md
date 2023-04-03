# OctopusConnect

This library is compatible with [Angular CLI](https://github.com/angular/angular-cli) version 14.

## Code scaffolding

Run `ng generate component component-name --project octopus-connect` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module --project octopus-connect`.
> Note: Don't forget to add `--project octopus-connect` or else it will be added to the default project in your `angular.json` file. 

## Build

Run `ng build octopus-connect` to build the project. The build artifacts will be stored in the `dist/` directory.

## Publishing

After building your library with `ng build octopus-connect`, go to the dist folder `cd dist/octopus-connect` and run `npm publish`.

## Running unit tests

Run `ng test octopus-connect` to execute the unit tests via [Karma](https://karma-runner.github.io).

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
