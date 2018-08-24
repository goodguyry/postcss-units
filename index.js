'use strict';

var extend = require('extend');
var postcss = require('postcss');
var valueParser = require('postcss-value-parser');

var funcExp = /(em\(|rem\()/;

function postcssUnits(options) {
  options = extend({
    size: 16,
    fallback: false,
    precision: 3
  }, options);

  if (options.size === 0) {
    options.size = 1;
  }

  return function(css) {
    css.walkDecls(function(decl) {
      if (!funcExp.test(decl.value)) {
        return;
      }

      var parsedValue = valueParser(decl.value).walk(function(node) {
        if (!isValidFunction(node)) {
          return;
        }

        node.type = 'word';
        const { nodes } = node;

        const filteredNodes = nodes.filter((item) =>
          isValidUnit(item) && item.type !== 'space');

        node.fallback = filteredNodes.reduce((acc, item) => {
          const { value: propValue } = item;
          const { value: units } = node;

          const parsedPropValue = valueParser.unit(propValue);
          if (isValidUnit(parsedPropValue)) {
            const { number: value, unit } = parsedPropValue;

            if (options.fallback && units === 'rem') {
              return `${acc} ${value}${unit}`;
            }
          }

          return acc;
        }, '')
          .trim();

        node.value = filteredNodes
          .map((item) => {
            const { value: propValue } = item;
            const { value: units } = node;

            const parsedPropValue = valueParser.unit(propValue);
            if (!isValidUnit(parsedPropValue)) {
              return `${decl.value}`;
            }

            const { number: value } = parsedPropValue;

            // Return if `auto`
            if (propValue === 'auto') {
              return `${propValue}`;
            }

            // Return `0` value un-processed
            if (Number(value) === 0) {
              return `${value}`;
            }

            // Return processed value(s)
            return `${convert(Number(value), options)}${units}`.trim();
          })
          .reduce((acc, value) => `${acc} ${value}`)
          .trim();
      });


      decl.value = parsedValue.toString().trim();

      if (options.fallback) {
        decl.cloneBefore({
          value: parsedValue.walk(function(node) {
            if (node.fallback) {
              node.value = node.fallback;
            }
          }).toString()
        });
      }
    });
  };
}

function isValidFunction(node) {
  var functions = {
    em: true,
    rem: true
  };
  return node.type === 'function' &&
    functions[node.value] &&
    node.nodes[0].type === 'word';
}

function isValidUnit(value) {
  return !value.unit || value.unit === 'px';
}

function convert(number, options) {
  return numberAfterPoint(number / options.size, options.precision);
}

/**
 * The function for rounding of numbers after the decimal point
 * @param number the original number
 * @param precision how many decimal places should be
 * @returns {number} final number
 */
function numberAfterPoint(number, precision) {
  var multiplier = Math.pow(10, precision + 1);
  var fullNumber = Math.floor(number * multiplier);
  return Math.round(fullNumber / 10) * 10 / multiplier;
}

module.exports = postcss.plugin('postcss-units', postcssUnits);
