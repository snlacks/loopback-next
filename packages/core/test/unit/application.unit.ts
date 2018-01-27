// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Constructor, Context} from '@loopback/context';
import {expect} from '@loopback/testlab';
import {Application, Server, Component, CoreBindings} from '../..';
import {
  Context,
  Constructor,
  Binding,
  Provider,
  inject,
} from '@loopback/context';

describe('Application', () => {
  describe('controller binding', () => {
    let app: Application;
    class MyController {}

    beforeEach(givenApp);

    it('binds a controller', () => {
      const binding = app.controller(MyController);
      expect(Array.from(binding.tagNames)).to.containEql('controller');
      expect(binding.key).to.equal('controllers.MyController');
      expect(findKeysByTag(app, 'controller')).to.containEql(binding.key);
    });

    it('binds a controller with custom name', () => {
      const binding = app.controller(MyController, 'my-controller');
      expect(Array.from(binding.tagNames)).to.containEql('controller');
      expect(binding.key).to.equal('controllers.my-controller');
      expect(findKeysByTag(app, 'controller')).to.containEql(binding.key);
    });

    function givenApp() {
      app = new Application();
    }
  });

  describe('component binding', () => {
    let app: Application;
    const binding = new Binding('foo');
    class MyController {}
    class MyClass {}
    class MyProvider implements Provider<string> {
      value() {
        return 'my-str';
      }
    }
    class MyComponent implements Component {
      controllers = [MyController];
      bindings = [binding];
      classes = {'my-class': MyClass};
      providers = {'my-provider': MyProvider};
    }

    class MyComponentWithDI implements Component {
      constructor(@inject(CoreBindings.APPLICATION_INSTANCE) ctx: Context) {
        // Porgramatically bind to the context
        ctx.bind('foo').to('bar');
      }
    }

    beforeEach(givenApp);

    it('binds a component', () => {
      app.component(MyComponent);
      expect(findKeysByTag(app, 'component')).to.containEql(
        'components.MyComponent',
      );
    });

    it('binds a component with custom name', () => {
      app.component(MyComponent, 'my-component');
      expect(findKeysByTag(app, 'component')).to.containEql(
        'components.my-component',
      );
    });

    it('binds bindings from a component', () => {
      app.component(MyComponent);
      expect(app.contains('controllers.MyController')).to.be.true();
      expect(app.getBinding('foo')).to.be.exactly(binding);
    });

    it('binds classes from a component', () => {
      app.component(MyComponent);
      expect(app.contains('my-class')).to.be.true();
      expect(app.getBinding('my-class').valueConstructor).to.be.exactly(
        MyClass,
      );
    });

    it('binds providers from a component', () => {
      app.component(MyComponent);
      expect(app.contains('my-provider')).to.be.true();
      expect(app.getSync('my-provider')).to.be.eql('my-str');
    });

    it('binds from a component constructor', () => {
      app.component(MyComponentWithDI);
      expect(app.contains('foo')).to.be.true();
      expect(app.getSync('foo')).to.be.eql('bar');
    });

    function givenApp() {
      app = new Application();
    }
  });

  describe('server binding', () => {
    it('defaults to constructor name', async () => {
      const app = new Application();
      const binding = app.server(FakeServer);
      expect(Array.from(binding.tagNames)).to.containEql('server');
      const result = await app.getServer(FakeServer.name);
      expect(result.constructor.name).to.equal(FakeServer.name);
    });

    it('allows custom name', async () => {
      const app = new Application();
      const name = 'customName';
      app.server(FakeServer, name);
      const result = await app.getServer(name);
      expect(result.constructor.name).to.equal(FakeServer.name);
    });

    it('allows binding of multiple servers as an array', async () => {
      const app = new Application();
      const bindings = app.servers([FakeServer, AnotherServer]);
      expect(Array.from(bindings[0].tagNames)).to.containEql('server');
      expect(Array.from(bindings[1].tagNames)).to.containEql('server');
      const fakeResult = await app.getServer(FakeServer);
      expect(fakeResult.constructor.name).to.equal(FakeServer.name);
      const AnotherResult = await app.getServer(AnotherServer);
      expect(AnotherResult.constructor.name).to.equal(AnotherServer.name);
    });
  });

  describe('start', () => {
    it('starts all injected servers', async () => {
      const app = new Application();
      app.component(FakeComponent);

      await app.start();
      const server = await app.getServer(FakeServer);
      expect(server).to.not.be.null();
      expect(server.listening).to.equal(true);
      await app.stop();
    });

    it('does not attempt to start poorly named bindings', async () => {
      const app = new Application();
      app.component(FakeComponent);

      // The app.start should not attempt to start this binding.
      app.bind('controllers.servers').to({});
      await app.start();
      await app.stop();
    });
  });

  function findKeysByTag(ctx: Context, tag: string | RegExp) {
    return ctx.findByTag(tag).map(binding => binding.key);
  }
});

class FakeComponent implements Component {
  servers: {
    [name: string]: Constructor<Server>;
  };
  constructor() {
    this.servers = {
      FakeServer,
      FakeServer2: FakeServer,
    };
  }
}

class FakeServer extends Context implements Server {
  listening: boolean = false;
  constructor() {
    super();
  }
  async start(): Promise<void> {
    this.listening = true;
  }

  async stop(): Promise<void> {
    this.listening = false;
  }
}

class AnotherServer extends FakeServer {}
