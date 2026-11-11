const NAMESPACE_URI = "http://ns.dithering.example/1.0/";
const PREFIX = "dith";
const EMPTY_PACKET = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
  + '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
  + "</rdf:RDF></x:xmpmeta><?xpacket end=\"w\"?>";

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeXml(text) {
  return String(text)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function removeField(xmp, name) {
  const attribute = new RegExp("\\s" + PREFIX + ":" + name + '="[^"]*"', "g");
  const element = new RegExp("<" + PREFIX + ":" + name + ">[^<]*</" + PREFIX + ":" + name + ">", "g");
  return xmp.replace(attribute, "").replace(element, "");
}

function setValue(xmp, name, value) {
  const base = removeField(xmp && xmp.indexOf("</rdf:RDF>") !== -1 ? xmp : EMPTY_PACKET, name);
  const description = '<rdf:Description rdf:about="" xmlns:' + PREFIX + '="' + NAMESPACE_URI + '" '
    + PREFIX + ":" + name + '="' + escapeXml(value) + '"/>';
  return base.replace("</rdf:RDF>", description + "</rdf:RDF>");
}

function getValue(xmp, name) {
  if (!xmp) return null;
  const attribute = new RegExp(PREFIX + ":" + name + '="([^"]*)"').exec(xmp);
  if (attribute) return unescapeXml(attribute[1]);
  const element = new RegExp("<" + PREFIX + ":" + name + ">([^<]*)</" + PREFIX + ":" + name + ">").exec(xmp);
  return element ? unescapeXml(element[1]) : null;
}

module.exports = { NAMESPACE_URI, setValue, getValue };
