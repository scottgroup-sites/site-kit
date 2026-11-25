// Facts every page shares (name, phone, address, hours, menu). Never hard-code them in a page.
export default {
  name: "__NAME__",
  url: "__URL__",
  menu: [{ label: "Home", url: "/" }],
  // Facts still waiting for the client, by name. The launch build refuses to run while any remain.
  placeholders: [],
};
