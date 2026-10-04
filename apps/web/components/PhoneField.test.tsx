// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneField } from "./PhoneField";

afterEach(cleanup);

/** The form around the field: holds the stored value, as every real form does. */
function Harness({
  initial = "",
  onStore,
}: {
  initial?: string;
  onStore?: (stored: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneField
      id="ph"
      value={value}
      onChange={(v) => {
        setValue(v);
        onStore?.(v);
      }}
    />
  );
}

const country = () => screen.getByLabelText("Country") as HTMLSelectElement;
const number = () => document.getElementById("ph") as HTMLInputElement;

describe("PhoneField", () => {
  it("stores E.164 for the picked country", () => {
    const onStore = vi.fn();
    render(<Harness onStore={onStore} />);
    fireEvent.change(country(), { target: { value: "NL" } });
    fireEvent.change(number(), { target: { value: "0612345678" } });
    expect(onStore).toHaveBeenLastCalledWith("+31612345678");
  });

  it("reads the same digits as a different number when the country changes", () => {
    const onStore = vi.fn();
    render(<Harness onStore={onStore} />);
    fireEvent.change(country(), { target: { value: "NL" } });
    fireEvent.change(number(), { target: { value: "0612345678" } });
    fireEvent.change(country(), { target: { value: "FR" } });
    expect(onStore).toHaveBeenLastCalledWith("+33612345678");
  });

  it("shows a stored international number in its own country", () => {
    render(<Harness initial="+33612345678" />);
    expect(country().value).toBe("FR");
    expect(number().value).toBe("06 12 34 56 78");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("follows a number typed with a +, whatever country is picked", () => {
    const onStore = vi.fn();
    render(<Harness onStore={onStore} />);
    fireEvent.change(country(), { target: { value: "FR" } });
    fireEvent.change(number(), { target: { value: "+44 20 7946 0958" } });
    expect(onStore).toHaveBeenLastCalledWith("+442079460958");
    expect(country().value).toBe("GB");
  });

  it("leaves a number saved before countries existed alone, and says so", () => {
    const onStore = vi.fn();
    render(<Harness initial="06 12 34 56 78" onStore={onStore} />);
    // Shown as it was saved, with no country guessed for it...
    expect(number().value).toBe("06 12 34 56 78");
    expect(country().value).toBe("");
    // ...never rewritten just by opening the form...
    expect(onStore).not.toHaveBeenCalled();
    // ...and the person is told it needs one.
    expect(screen.getByRole("note")).toHaveTextContent("Country not set");
  });

  it("converts a legacy number once the person picks its country", () => {
    const onStore = vi.fn();
    render(<Harness initial="06 12 34 56 78" onStore={onStore} />);
    fireEvent.change(country(), { target: { value: "FR" } });
    expect(onStore).toHaveBeenLastCalledWith("+33612345678");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("lets the person pick the right country for a number saved under the wrong one", () => {
    // A French number typed while the dropdown sat on the United States.
    // It isn't valid there, so what gets saved carries the picker's +1.
    const typed = vi.fn();
    const first = render(<Harness onStore={typed} />);
    fireEvent.change(country(), { target: { value: "US" } });
    fireEvent.change(number(), { target: { value: "06 12 34 56 78" } });
    const saved = typed.mock.calls.at(-1)?.[0] as string;
    expect(saved).toBe("+10612345678");
    first.unmount();

    // Back on the page. The dial code is not shown as if it were typed...
    const onStore = vi.fn();
    render(<Harness initial={saved} onStore={onStore} />);
    expect(number().value).toBe("0612345678");
    expect(country().value).toBe("");
    expect(screen.getByRole("note")).toHaveTextContent("Country not set");
    // ...and picking the right country corrects it. This did nothing: the
    // text started with "+", which states its own country, so the picker
    // was ignored.
    fireEvent.change(country(), { target: { value: "FR" } });
    expect(onStore).toHaveBeenLastCalledWith("+33612345678");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("flags an unfinished number without blocking it", () => {
    const onStore = vi.fn();
    render(<Harness onStore={onStore} />);
    fireEvent.change(country(), { target: { value: "FR" } });
    fireEvent.change(number(), { target: { value: "06 12" } });
    expect(screen.getByRole("note")).toHaveTextContent("doesn't look complete");
    expect(onStore).toHaveBeenLastCalledWith("+33" + "0612");
  });

  it("clears the stored value when the number is cleared", () => {
    const onStore = vi.fn();
    render(<Harness initial="+33612345678" onStore={onStore} />);
    fireEvent.change(number(), { target: { value: "" } });
    expect(onStore).toHaveBeenLastCalledWith("");
  });

  it("shows a number the form loads after the first render", () => {
    const { rerender } = render(
      <PhoneField id="ph" value="" onChange={() => {}} />,
    );
    rerender(<PhoneField id="ph" value="+31612345678" onChange={() => {}} />);
    expect(country().value).toBe("NL");
    expect(number().value).toBe("06 12345678");
  });
});
