"use client";

import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { dateAllowed, dateFromDisplay, dateToDisplay, numericError, timeFromDisplay, timeToDisplay, validDate } from "./field-values";
import styles from "./fields.module.css";

const Chevron = ({ direction = "down" }: { direction?: "down" | "left" | "right" }) => <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={direction === "left" ? styles.left : direction === "right" ? styles.right : undefined}><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const CalendarIcon = () => <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M6.5 3v4M13.5 3v4M3 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
const ClockIcon = () => <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;

function useReset(ref: RefObject<HTMLElement | null>, reset: () => void) {
  const latest = useRef(reset);
  useEffect(() => { latest.current = reset; });
  useEffect(() => {
    const form = ref.current?.closest("form");
    const handler = () => latest.current();
    form?.addEventListener("reset", handler);
    return () => form?.removeEventListener("reset", handler);
  }, [ref]);
}

function usePopover(root: RefObject<HTMLElement | null>, panel: RefObject<HTMLDivElement | null>, restore: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 292), window.innerWidth - 24);
      const measuredHeight = Math.min(panel.current?.scrollHeight ?? 360, 410);
      const spaceBelow = window.innerHeight - rect.bottom - 20;
      const above = spaceBelow < Math.min(measuredHeight, 250) && rect.top > spaceBelow;
      const available = Math.max(120, above ? rect.top - 20 : spaceBelow);
      setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: above ? Math.max(12, rect.top - Math.min(measuredHeight, available) - 8) : rect.bottom + 8, maxHeight: available, visibility: "visible" });
    }
    place();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target) && !(target instanceof Element && target.closest("[data-aux-field-popover]"))) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && panel.current === [...document.querySelectorAll("[data-aux-field-popover]")].at(-1)) { event.preventDefault(); setOpen(false); restore.current?.focus(); }
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open, root, panel, restore]);
  return { open, setOpen, position };
}

function Popover({ children, open, panel, position, label, role = "dialog", id }: { children: ReactNode; open: boolean; panel: RefObject<HTMLDivElement | null>; position: CSSProperties; label: string; role?: "dialog" | "listbox"; id?: string }) {
  if (!open) return null;
  return createPortal(<div id={id} ref={panel} role={role} aria-label={label} data-aux-field-popover className={styles.popover} style={position}>{children}</div>, document.body);
}

type Option = { value: string; label: string; disabled: boolean };
function readOptions(children: ReactNode, disabled = false): Option[] {
  const options: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return;
    if (child.type === Fragment || child.type === "optgroup") options.push(...readOptions(child.props.children, disabled || Boolean(child.props.disabled)));
    else if (child.type === "option") {
      const label = Children.toArray(child.props.children).join("");
      options.push({ value: String(child.props.value ?? label), label, disabled: disabled || Boolean(child.props.disabled) });
    }
  });
  return options;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "multiple" | "size">;
export function SelectField({ children, name, id, defaultValue, value: controlledValue, onChange, className = "", required, disabled, ...rest }: SelectProps) {
  const options = readOptions(children);
  const initial = String(defaultValue ?? options[0]?.value ?? "");
  const [ownValue, setValue] = useState(initial);
  const value = controlledValue !== undefined ? String(controlledValue) : ownValue;
  const [active, setActive] = useState(Math.max(0, options.findIndex((option) => option.value === value)));
  const [invalid, setInvalid] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const uid = useId();
  const picker = usePopover(root, panel, trigger);
  const selected = options.find((option) => option.value === value);
  const accessibleLabel = rest["aria-label"] ?? "Choose an option";
  useReset(root, () => { setValue(initial); setInvalid(false); picker.setOpen(false); });
  useEffect(() => { if (picker.open) panel.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, picker.open]);

  function choose(option: Option) {
    if (option.disabled || disabled) return;
    setValue(option.value); setInvalid(false); picker.setOpen(false);
    if (native.current) {
      native.current.value = option.value;
      onChange?.({ target: native.current, currentTarget: native.current, type: "change" } as ChangeEvent<HTMLSelectElement>);
    }
    trigger.current?.focus();
  }
  function move(direction: number) {
    let next = active;
    for (let i = 0; i < options.length; i++) { next = (next + direction + options.length) % options.length; if (!options[next].disabled) break; }
    setActive(next);
  }
  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!picker.open) { setActive(Math.max(0, options.findIndex((option) => option.value === value))); picker.setOpen(true); }
      else if (event.key === "Home") setActive(Math.max(0, options.findIndex((option) => !option.disabled)));
      else if (event.key === "End") setActive(options.findLastIndex((option) => !option.disabled));
      else move(event.key === "ArrowDown" ? 1 : -1);
    } else if ((event.key === "Enter" || event.key === " ") && picker.open) { event.preventDefault(); if (options[active]) choose(options[active]); }
    else if (event.key === "Tab") picker.setOpen(false);
    else if (event.key.length === 1 && event.key !== " ") {
      const lower = event.key.toLocaleLowerCase();
      const match = options.findIndex((option, index) => index > active && !option.disabled && option.label.toLocaleLowerCase().startsWith(lower));
      const next = match >= 0 ? match : options.findIndex((option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(lower));
      if (next >= 0) { setActive(next); picker.setOpen(true); }
    }
  }
  return <span ref={root} className={styles.root}>
    <button id={id} ref={trigger} type="button" disabled={disabled} className={`${styles.input} ${styles.select} ${className}`} role="combobox" aria-label={rest["aria-label"]} aria-labelledby={rest["aria-labelledby"]} aria-describedby={rest["aria-describedby"]} aria-required={required} aria-invalid={invalid || rest["aria-invalid"]} aria-expanded={picker.open} aria-controls={`${uid}-options`} aria-activedescendant={picker.open ? `${uid}-option-${active}` : undefined} onKeyDown={onKey} onClick={() => { setActive(Math.max(0, options.findIndex((option) => option.value === value))); picker.setOpen(!picker.open); }}>
      <span>{selected?.label ?? "Select an option"}</span><Chevron />
    </button>
    <select {...rest} ref={native} name={name} value={value} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" className={styles.native} onChange={(event) => { setValue(event.target.value); onChange?.(event); }} onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }}>{children}</select>
    <Popover id={`${uid}-options`} open={picker.open} panel={panel} position={picker.position} label={accessibleLabel} role="listbox"><div className={styles.options}>{options.map((option, index) => <div id={`${uid}-option-${index}`} key={`${option.value}-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} data-option-index={index} data-active={index === active} className={styles.option} onPointerMove={() => { if (!option.disabled) setActive(index); }} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><span>{option.label}</span>{option.value === value && <span aria-hidden="true">✓</span>}</div>)}</div></Popover>
    {invalid && <span className={styles.error} role="alert">Choose an option.</span>}
  </span>;
}

type NumericProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"> & { defaultValue?: string | number; value?: string | number; min?: string | number; max?: string | number; step?: string | number; range?: boolean; unit?: string; label?: string; onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"] };
export function NumberField({ defaultValue = "", value: controlledValue, range = false, unit, label, min, max, step = 1, name, id, disabled, required, className = "", onChange, ...rest }: NumericProps) {
  const initial = String(defaultValue);
  const [ownValue, setValue] = useState(initial);
  const value = controlledValue !== undefined ? String(controlledValue) : ownValue;
  const [error, setError] = useState("");
  const root = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const native = useRef<HTMLInputElement>(null);
  const uid = useId();
  const minNumber = min === undefined ? undefined : Number(min);
  const maxNumber = max === undefined ? undefined : Number(max);
  const stepNumber = step === "any" ? "any" : Number(step);
  const allowedStep = typeof stepNumber === "number" && Number.isFinite(stepNumber) ? stepNumber : undefined;
  useReset(root, () => { setValue(initial); setError(""); input.current?.setCustomValidity(""); });
  function update(next: string, event?: ChangeEvent<HTMLInputElement>) {
    setValue(next); setError("");
    const message = numericError(next, minNumber, maxNumber, stepNumber === "any" ? "any" : allowedStep);
    input.current?.setCustomValidity(message);
    if (native.current) {
      native.current.value = message ? "" : next;
      if (event) onChange?.({ ...event, target: native.current, currentTarget: native.current } as ChangeEvent<HTMLInputElement>);
    }
  }
  const exact = <input {...rest} id={id} ref={input} type="text" inputMode={stepNumber === 1 ? "numeric" : "decimal"} disabled={disabled} required={required} value={value} aria-label={rest["aria-label"] ?? label} aria-describedby={[rest["aria-describedby"], error ? `${uid}-error` : ""].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(error) || rest["aria-invalid"]} className={`${styles.input} ${range ? styles.exact : ""} ${className}`} onChange={(event) => update(event.target.value, event)} onBlur={(event) => { const message = numericError(event.target.value, minNumber, maxNumber, stepNumber === "any" ? "any" : allowedStep); input.current?.setCustomValidity(message); setError(message); rest.onBlur?.(event); }} onInvalid={() => { setError(input.current?.validationMessage ?? "Enter a number."); }} />;
  return <span ref={root} className={`${styles.root} ${range ? styles.numberRoot : ""}`}>
    {range ? <><span className={styles.numberLine}>{label && <span className={styles.numberLabel}>{label}</span>}<span className={styles.numberValue}>{exact}{unit && <span className={styles.unit}>{unit}</span>}</span></span><input type="range" disabled={disabled} min={min} max={max} step={step} value={value === "" || !Number.isFinite(Number(value)) ? min ?? 0 : Math.max(minNumber ?? 0, Math.min(maxNumber ?? 100, Number(value)))} aria-label={`${rest["aria-label"] ?? label ?? name?.replace(/([A-Z])/g, " $1") ?? "Value"} slider`} aria-labelledby={rest["aria-labelledby"]} aria-describedby={id} className={styles.range} onChange={(event) => update(event.target.value, event)} /><span className={styles.rangeLabels}><span>{min ?? 0}</span><span>{max ?? 100}</span></span></> : exact}
    <input ref={native} name={name} type="number" value={numericError(value, minNumber, maxNumber, stepNumber === "any" ? "any" : allowedStep) ? "" : value} min={min} max={max} step={step} disabled={disabled} required={required} tabIndex={-1} aria-hidden="true" className={styles.native} onChange={() => {}} onInvalid={(event) => { event.preventDefault(); input.current?.focus(); setError(input.current?.validationMessage ?? "Enter a valid number."); }} />
    {error && <span id={`${uid}-error`} className={styles.error} role="alert">{error}</span>}
  </span>;
}

type TemporalProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "min" | "max"> & { defaultValue?: string; value?: string; min?: string; max?: string };
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function dateParts(value: string) { const date = validDate(value) ? new Date(`${value}T12:00:00`) : new Date(); return { year: date.getFullYear(), month: date.getMonth() }; }
function isoDate(year: number, month: number, day: number) { return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

export function DateField({ name, id, defaultValue = "", value: controlledValue, min, max, required, disabled, className = "", onChange, ...rest }: TemporalProps) {
  const [ownValue, setValue] = useState(defaultValue);
  const value = controlledValue ?? ownValue;
  const [display, setDisplay] = useState(dateToDisplay(value));
  const [lastControlledValue, setLastControlledValue] = useState(controlledValue);
  if (controlledValue !== lastControlledValue) { setLastControlledValue(controlledValue); setDisplay(dateToDisplay(controlledValue ?? ownValue)); }
  const [error, setError] = useState("");
  const [view, setView] = useState(() => dateParts(value));
  const [yearText, setYearText] = useState(String(view.year));
  const [focusDate, setFocusDate] = useState("");
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const native = useRef<HTMLInputElement>(null);
  const picker = usePopover(root, panel, input);
  const uid = useId();
  useReset(root, () => { setValue(defaultValue); setDisplay(dateToDisplay(defaultValue)); setError(""); input.current?.setCustomValidity(""); picker.setOpen(false); });
  useEffect(() => { if (picker.open && focusDate) panel.current?.querySelector<HTMLElement>(`[data-date="${focusDate}"]`)?.focus(); }, [focusDate, picker.open, view]);
  function check(text: string) {
    const iso = dateFromDisplay(text);
    if (!text.trim()) return "";
    if (!iso) return "Enter a valid date as MM/DD/YYYY.";
    if (min && iso < min) return `Choose ${dateToDisplay(min)} or later.`;
    if (max && iso > max) return `Choose ${dateToDisplay(max)} or earlier.`;
    return "";
  }
  function change(next: string, text = dateToDisplay(next)) {
    setValue(next); setDisplay(text); setError(""); input.current?.setCustomValidity(check(text));
    if (native.current) { native.current.value = next; onChange?.({ target: native.current, currentTarget: native.current, type: "change" } as ChangeEvent<HTMLInputElement>); }
  }
  function choose(next: string) { change(next); picker.setOpen(false); input.current?.focus(); }
  function openCalendar() {
    let candidate = value || today;
    if (min && candidate < min) candidate = min;
    if (max && candidate > max) candidate = max;
    const next = dateParts(candidate); setView(next); setYearText(String(next.year)); setFocusDate(candidate); picker.setOpen(!picker.open);
  }
  function showMonth(year: number, month: number) {
    const date = new Date(year, month, 1); date.setFullYear(year, month, 1);
    if (date.getFullYear() < 1 || date.getFullYear() > 9999) return;
    setView({ year: date.getFullYear(), month: date.getMonth() }); setYearText(String(date.getFullYear()));
  }
  function dayKey(event: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const jumps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in jumps) {
      event.preventDefault(); const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + jumps[event.key]);
      const next = isoDate(date.getFullYear(), date.getMonth(), date.getDate());
      if (dateAllowed(next, min, max)) { showMonth(date.getFullYear(), date.getMonth()); setFocusDate(next); }
    }
  }
  const first = new Date(0); first.setFullYear(view.year, view.month, 1);
  const last = new Date(0); last.setFullYear(view.year, view.month + 1, 0);
  const firstDay = first.getDay();
  const days = last.getDate();
  const allDates = Array.from({ length: days }, (_, index) => isoDate(view.year, view.month, index + 1));
  const rovingDate = allDates.includes(focusDate) && dateAllowed(focusDate, min, max) ? focusDate : allDates.find((iso) => dateAllowed(iso, min, max));
  const todayParts = dateParts("");
  const today = isoDate(todayParts.year, todayParts.month, new Date().getDate());
  return <span ref={root} className={styles.root}>
    <span className={styles.inputWithIcon}><input {...rest} id={id} ref={input} type="text" inputMode="text" value={display} required={required} disabled={disabled} placeholder={rest.placeholder ?? "MM/DD/YYYY"} className={`${styles.input} ${className}`} aria-describedby={[rest["aria-describedby"], error ? `${uid}-error` : ""].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(error) || rest["aria-invalid"]} onChange={(event) => change(dateFromDisplay(event.target.value), event.target.value)} onBlur={(event) => { const message = check(event.target.value); input.current?.setCustomValidity(message); setError(message); if (!message && value) setDisplay(dateToDisplay(value)); rest.onBlur?.(event); }} onInvalid={() => setError(input.current?.validationMessage ?? "Enter a date.")} onKeyDown={(event) => { if (event.key === "ArrowDown" && event.altKey) { event.preventDefault(); openCalendar(); } rest.onKeyDown?.(event); }} /><button type="button" disabled={disabled} className={styles.iconButton} aria-label="Choose date" aria-expanded={picker.open} onClick={openCalendar}><CalendarIcon /></button></span>
    <input ref={native} type="date" name={name} value={value} min={min} max={max} required={required} disabled={disabled} className={styles.native} tabIndex={-1} aria-hidden="true" onChange={() => {}} onInvalid={(event) => { event.preventDefault(); input.current?.focus(); setError(input.current?.validationMessage ?? "Enter a valid date."); }} />
    <Popover open={picker.open} panel={panel} position={picker.position} label="Choose date"><div className={styles.calendar}>
      <div className={styles.calendarTop}><button type="button" aria-label="Previous month" className={styles.smallButton} onClick={() => showMonth(view.year, view.month - 1)}><Chevron direction="left" /></button><SelectField aria-label="Month" value={String(view.month)} onChange={(event) => showMonth(view.year, Number(event.target.value))} className={styles.monthSelect}>{monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}</SelectField><input aria-label="Year" inputMode="numeric" className={styles.year} value={yearText} onChange={(event) => { const next = event.target.value.replace(/\D/g, "").slice(0, 4); setYearText(next); if (next.length === 4 && Number(next) > 0) setView({ ...view, year: Number(next) }); }} onBlur={() => setYearText(String(view.year))} /><button type="button" aria-label="Next month" className={styles.smallButton} onClick={() => showMonth(view.year, view.month + 1)}><Chevron direction="right" /></button></div>
      <div className={styles.weekdays} aria-hidden="true">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.days}>{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const iso = isoDate(view.year, view.month, day); return <button type="button" key={iso} data-date={iso} aria-label={`${monthNames[view.month]} ${day}, ${view.year}`} aria-pressed={value === iso} aria-current={today === iso ? "date" : undefined} disabled={!dateAllowed(iso, min, max)} className={styles.day} tabIndex={rovingDate === iso ? 0 : -1} onKeyDown={(event) => dayKey(event, iso)} onClick={() => choose(iso)}>{day}</button>; })}</div>
      <div className={styles.pickerFooter}>{!required && <button type="button" className={styles.textButton} onClick={() => choose("")}>Clear</button>}<button type="button" className={styles.textButton} disabled={!dateAllowed(today, min, max)} onClick={() => choose(today)}>Today</button><button type="button" className={styles.textButton} onClick={() => { picker.setOpen(false); input.current?.focus(); }}>Close</button></div>
    </div></Popover>
    {error && <span id={`${uid}-error`} className={styles.error} role="alert">{error}</span>}
  </span>;
}

export function TimeField({ name, id, defaultValue = "", value: controlledValue, min, max, step = 60, required, disabled, className = "", onChange, ...rest }: TemporalProps) {
  const [ownValue, setValue] = useState(defaultValue);
  const value = controlledValue ?? ownValue;
  const [display, setDisplay] = useState(timeToDisplay(value));
  const [lastControlledValue, setLastControlledValue] = useState(controlledValue);
  if (controlledValue !== lastControlledValue) { setLastControlledValue(controlledValue); setDisplay(timeToDisplay(controlledValue ?? ownValue)); }
  const [error, setError] = useState("");
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const native = useRef<HTMLInputElement>(null);
  const picker = usePopover(root, panel, input);
  const uid = useId();
  const selected = timeFromDisplay(value) || "09:00";
  const [hours, minutes, seconds] = selected.split(":");
  const twentyFour = Number(hours);
  useEffect(() => { if (picker.open) panel.current?.querySelector<HTMLElement>("[role=combobox]")?.focus(); }, [picker.open]);
  useReset(root, () => { setValue(defaultValue); setDisplay(timeToDisplay(defaultValue)); setError(""); input.current?.setCustomValidity(""); picker.setOpen(false); });
  function check(text: string) {
    const time = timeFromDisplay(text);
    if (!text.trim()) return "";
    if (!time) return "Enter a valid time, such as 9:30 AM.";
    if (min && max && min > max) { if (time < min && time > max) return "Choose a time within the allowed hours."; }
    else { if (min && time < min) return `Choose ${timeToDisplay(min)} or later.`; if (max && time > max) return `Choose ${timeToDisplay(max)} or earlier.`; }
    return "";
  }
  function change(next: string, text = timeToDisplay(next)) {
    setValue(next); setDisplay(text); setError(""); input.current?.setCustomValidity(check(text));
    if (native.current) { native.current.value = next; onChange?.({ target: native.current, currentTarget: native.current, type: "change" } as ChangeEvent<HTMLInputElement>); }
  }
  function chooseParts(hour: number, minute: string, period: string) { change(`${String(hour % 12 + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}${seconds ? `:${seconds}` : ""}`); }
  return <span ref={root} className={styles.root}>
    <span className={styles.inputWithIcon}><input {...rest} id={id} ref={input} type="text" value={display} required={required} disabled={disabled} placeholder={rest.placeholder ?? "9:00 AM"} className={`${styles.input} ${className}`} aria-describedby={[rest["aria-describedby"], error ? `${uid}-error` : ""].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(error) || rest["aria-invalid"]} onChange={(event) => change(timeFromDisplay(event.target.value), event.target.value)} onBlur={(event) => { const message = check(event.target.value); input.current?.setCustomValidity(message); setError(message); if (!message && value) setDisplay(timeToDisplay(value)); rest.onBlur?.(event); }} onInvalid={() => setError(input.current?.validationMessage ?? "Enter a time.")} onKeyDown={(event) => { if (event.key === "ArrowDown" && event.altKey) { event.preventDefault(); picker.setOpen(true); } rest.onKeyDown?.(event); }} /><button type="button" className={styles.iconButton} disabled={disabled} aria-label="Choose time" aria-expanded={picker.open} onClick={() => picker.setOpen(!picker.open)}><ClockIcon /></button></span>
    <input ref={native} name={name} type="time" value={value} min={min} max={max} step={step} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" className={styles.native} onChange={() => {}} onInvalid={(event) => { event.preventDefault(); input.current?.focus(); setError(native.current?.validationMessage ?? "Enter a valid time."); }} />
    <Popover open={picker.open} panel={panel} position={picker.position} label="Choose time"><div className={styles.timePicker}><p className={styles.pickerTitle}>Choose a time</p><div className={styles.timeFields}>
      <label className={styles.smallLabel}>Hour<SelectField value={String(twentyFour % 12 || 12)} onChange={(event) => chooseParts(Number(event.target.value), minutes, twentyFour < 12 ? "AM" : "PM")}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</SelectField></label>
      <label className={styles.smallLabel}>Minute<SelectField value={minutes} onChange={(event) => chooseParts(twentyFour % 12 || 12, event.target.value, twentyFour < 12 ? "AM" : "PM")}>{Array.from({ length: 60 }, (_, index) => <option key={index} value={String(index).padStart(2, "0")}>{String(index).padStart(2, "0")}</option>)}</SelectField></label>
      <label className={styles.smallLabel}>AM / PM<SelectField value={twentyFour < 12 ? "AM" : "PM"} onChange={(event) => chooseParts(twentyFour % 12 || 12, minutes, event.target.value)}><option value="AM">AM</option><option value="PM">PM</option></SelectField></label>
    </div><div className={styles.pickerFooter}>{!required && <button type="button" className={styles.textButton} onClick={() => { change(""); picker.setOpen(false); input.current?.focus(); }}>Clear</button>}<button type="button" className={styles.doneButton} onClick={() => { if (!value) change(selected); picker.setOpen(false); input.current?.focus(); }}>Done</button></div></div></Popover>
    {error && <span id={`${uid}-error`} className={styles.error} role="alert">{error}</span>}
  </span>;
}
