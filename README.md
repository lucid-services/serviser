[![Build Status](https://travis-ci.org/lucid-services/serviser.svg?branch=master)](https://travis-ci.org/lucid-services/serviser)  [![Test Coverage](https://codeclimate.com/github/lucid-services/serviser/badges/coverage.svg)](https://codeclimate.com/github/lucid-services/serviser/coverage) [![npm version](https://badge.fury.io/js/serviser.svg)](https://www.npmjs.com/package/serviser)  

[![Serviser Logo](https://github.com/lucid-services/serviser/raw/master/logo.png)](https://lucid-services.github.io/serviser)

`serviser` is an abstraction layer with common interface for creating not-only web applications but also any apps that match the `request & response` pattern whether an underlying communication protocol is `HTTP`, `AMQP` (message queues), `IPC` or other..  
Emphasis is put among other [features](https://github.com/lucid-services/serviser#features) on product API documentation, validation, error handling and automation of perpetually repeated tasks.

**Why?**  
So that basic project foundations and application architecture doesn't need to be invented again and again for each (web) service.  
The project empowers minimalistic but mature libraries like [express](https://github.com/expressjs/express) and does its job on top of them striving for clean scalable, testable and consistent applications.

Features
-------------------
* **Promises!**
* [JSON Schema](http://json-schema.org/) integration
* Environment-aware
* App lifecycle events
* Resource & Service integrity inspection capabilities (health monitoring)
* **Documentation autogeneration**
* **A SDK client package autogeneration**
* response data filters
* request data validation
* shell integration
* caching solutions
* Semantic Service versioning
* and more (see Public API Reference)!

Resources
-------------------
* [Getting started](https://lucid-services.github.io/serviser/tutorial-1.Getting-started.html)
* [Public API Reference](https://lucid-services.github.io/serviser/)
* [Changelog](./CHANGELOG.md)

Tests
-------------------

`npm test`

