export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(
  text: string,
  action: () => void,
  className = "",
): HTMLButtonElement {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("Missing element " + id);
  return node as T;
}
let fieldId = 0;
export function field(label: string, input: HTMLElement): HTMLDivElement {
  const node = el("div", "field");
  if (!input.id) input.id = "field-" + ++fieldId;
  const caption = el("label", "field-label", label);
  caption.htmlFor = input.id;
  node.append(caption, input);
  return node;
}
export function select(
  options: [string, string][],
  value?: string,
): HTMLSelectElement {
  const node = el("select");
  for (const [key, label] of options) {
    const option = el("option", "", label);
    option.value = key;
    node.append(option);
  }
  if (value) node.value = value;
  return node;
}
export function input(
  placeholder: string,
  maxLength: number,
  value = "",
): HTMLInputElement {
  const node = el("input");
  node.placeholder = placeholder;
  node.maxLength = maxLength;
  node.value = value;
  return node;
}
export function dialog(
  title: string,
  text: string,
  choices: { label: string; action: () => void; primary?: boolean }[],
): void {
  const modal = el("dialog", "choice-dialog");
  modal.append(el("h2", "", title), el("p", "", text));
  const controls = el("div", "dialog-actions");
  for (const choice of choices)
    controls.append(
      button(
        choice.label,
        () => {
          modal.close();
          modal.remove();
          choice.action();
        },
        choice.primary ? "primary" : "",
      ),
    );
  modal.append(controls);
  document.body.append(modal);
  modal.addEventListener("cancel", (event) => event.preventDefault());
  modal.showModal();
}
