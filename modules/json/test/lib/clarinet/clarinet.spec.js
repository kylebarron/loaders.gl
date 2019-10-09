import test from 'tape-promise/tape';
import TestListener from './test-listener';
import {parser} from '@loaders.gl/json/lib/clarinet/clarinet';

// tslint:disable:object-literal-sort-keys
const literalCases = [
  { type: "null", cases: ["null"] },
  { type: "boolean", cases: ["true", "false"] },
  { type: "integer", cases: ["0", "9007199254740991", "-9007199254740991"] },
  {
    type: "real",
    cases: [
      "1E1",
      "0.1e1",
      "1e-1",
      "1e+00",
      JSON.stringify(Number.MAX_VALUE),
      JSON.stringify(Number.MIN_VALUE),
    ]
  }
];
// tslint:enable:object-literal-sort-keys

const stringLiterals = [
  ["empty", JSON.stringify("")],
  ["space", JSON.stringify(" ")],
  ["quote", JSON.stringify("\"")],
  ["backslash", JSON.stringify("\\")],
  ["slash", "\"/ & \\/\""],
  ["control", JSON.stringify("\b\f\n\r\t")],
  ["unicode", JSON.stringify("\u0022")],
  ["non-unicode", JSON.stringify("&#34; %22 0x22 034 &#x22;")],
  ["surrogate", "\"😀\""],
];

const arrayLiterals = [
  "[]",
  "[null]",
  "[true, false]",
  "[0,1, 2,  3,\n4]",
  "[[\"2 deep\"]]",
];

const objectLiterals = [
  "{}",
  "\n {\n \"\\b\"\n :\n\"\"\n }\n ",
  "{\"\":\"\"}",
  "{\"1\":{\"2\":\"deep\"}}",
];

const parseWithClarinet = (json) => {
  const p = parser();
  const sink = new TestListener(p);
  p.write(json);
  p.close();
  return sink.result;
};

function testCase(t, json, description) {
  description = description ? ` (${description})` : '';
  const expected = JSON.parse(json);
  const message = `${JSON.stringify(json)} -> ${JSON.stringify(expected)}${description}`;
  const actual = parseWithClarinet(json);
  t.deepEqual(actual, expected, message);
}

test("clarinet#string literal", t => {

  for (const cases of literalCases) {
    for (const json of cases.cases) {
      stringLiterals.push([`quoted ${cases.type}`, `"${json}"`]);
      // Clarinet does not currently support (null | boolean | number | string) as root value.
      // To work around this, we wrap the literal in an array before passing to 'test()'.
      // (See: https://github.com/dscape/clarinet/issues/49)
      testCase(t, `[${json}]`, `${cases.type} literal`);
    }
  }
  t.end();
});

test("clarinet#string literal", t => {
  for (const [description, json] of stringLiterals) {
      // Clarinet does not current support (null | boolean | number | string) as root value.
      // To work around this, we wrap the literal in an array before passing to 'test()'.
      // (See: https://github.com/dscape/clarinet/issues/49)
      testCase(t, `[${json}]`, description);
  }
  t.end();
});

test("clarinet#array literal", t => {
  for (const json of arrayLiterals) {
    testCase(t, json);
  }
  t.end();
});

test("clarinet#object literal", t => {
  for (const json of objectLiterals) {
    testCase(t, json);
  t.end();
  }
});
