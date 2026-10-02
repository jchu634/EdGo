const React = require("react");
// Substitute the native WebView bridge; its document is checked in the browser.
module.exports = {
  __esModule: true,
  default: React.forwardRef(function RichEditor(props, ref) {
    React.useImperativeHandle(ref, () => ({
      format: (format) => props.onFormat?.(format),
      flush: async () => props.content,
    }));
    return React.createElement("RichEditor", props);
  }),
};
