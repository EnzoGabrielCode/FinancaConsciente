const React = require('react');
const {View} = require('react-native');

function LinearGradient(props) {
  return React.createElement(View, props, props.children);
}

module.exports = LinearGradient;
module.exports.default = LinearGradient;
