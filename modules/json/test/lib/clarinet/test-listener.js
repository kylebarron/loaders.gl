
/**
 * TestListener uses the events emitted by the Clarinet.js parser to rebuild the original object.
 * It is convenient for writing tests that work by 'deepEqual()' comparing the result with the
 * result from 'JSON.parse()'.
 */
export default class TestListener {
  constructor(parser) {
    this.reset();

    parser.onready = () => {
      this.previousStates.length = 0;
      this.currentState.container.length = 0;
    };

    parser.onopenobject = (name) => {
      this.openContainer({});
      typeof name === 'undefined' || parser.onkey(name);
    };

    parser.onkey = (name) => {
      this.currentState.key = name;
    };

    parser.oncloseobject = () => {
      this.closeContainer();
    };

    parser.onopenarray = () => {
      this.openContainer([]);
    };

    parser.onclosearray = () => {
      this.closeContainer();
    };

    parser.onvalue = (value) => {
      this.pushOrSet(value);
    };

    parser.onerror = (error) => {
      throw error;
    };

    parser.onend = () => {
      this.result = this.currentState.container.pop();
    };
  }

  reset() {
    this.result = undefined;
    this.previousStates = [];
    this.currentState = Object.freeze({ container: [], key: null });
  }

  pushOrSet(value) {
    const { container, key } = this.currentState;
    if (key !== null) {
      // eslint-disable-next-line security/detect-object-injection
      container[key] = value;
      this.currentState.key = null;
    } else {
      container.push(value);
    }
  }

  openContainer(newContainer) {
    this.pushOrSet(newContainer);
    this.previousStates.push(this.currentState);
    this.currentState = { container: newContainer, key: null };
  }

  closeContainer() {
    this.currentState = this.previousStates.pop();
  }
}
