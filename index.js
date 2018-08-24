'use strict';

const postcss = require('postcss');
const valueParser = require('postcss-value-parser');

const funcExp = /(em\(|rem\()/;

function postcssUnits(options) {
  options = Object.assign({
    size: 16,
    fallback: false,
    precision: 3
  }, options);

  if (options.size === 0) {
    options.size = 1;
  }

  return function(css) {
    css.walkDecls((decl) => {
      if (!funcExp.test(decl.value)) {
        return;
      }

      const parsedValue = valueParser(decl.value).walk((node) => {
        if (!isValidFunction(node)) {
          return;
        }

        node.type = 'word';
        const { nodes } = node;

        // Filter out invalid values
        const filteredNodes = nodes.filter((item) =>
          isValidUnit(item) && item.type !== 'space');

        // Conditionally collect fallback value(s)
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

        // Collect node value(s)
        node.value = filteredNodes
          .map((item) => {
            const { value: propValue } = item;
            const { value: units } = node;

            const parsedPropValue = valueParser.unit(propValue);
            if (!isValidUnit(parsedPropValue)) {
              return `${decl.value}`;
            }

            const { number: value } = parsedPropValue;
            const number = Number(value);

            // Do no process `auto`
            if (propValue === 'auto') {
              return `${propValue}`;
            }

            // Do not process `0`
            if (number === 0) {
              return `${value}`;
            }

            // Return processed value(s)
            return `${convert(number, options)}${units}`.trim();
          })
          .reduce((acc, value) => `${acc} ${value}`)
          .trim();
      });

      decl.value = parsedValue.toString();

      if (options.fallback) {
        decl.cloneBefore({
          value: parsedValue.nodes
            .filter((node) => node.type !== 'space')
            .map((node) => node.fallback ? node.fallback : node.value, '')
            .reduce((acc, value) => `${acc} ${value}`)
        });
      }
    });
  };
}

function isValidFunction(node) {
  return node.type === 'function' &&
    ['em', 'rem'].includes(node.value) &&
    node.nodes[0].type === 'word';
}

function isValidUnit(value) {
  const { unit } = value;
  return !unit || unit === 'px';
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
  const multiplier = Math.pow(10, precision + 1);
  const fullNumber = Math.floor(number * multiplier);
  return Math.round(fullNumber / 10) * 10 / multiplier;
}

module.exports = postcss.plugin('postcss-units', postcssUnits);
