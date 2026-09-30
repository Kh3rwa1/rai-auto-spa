import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import * as PhoneInputModule from "react-phone-input-2";
import type { PhoneInputProps } from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { countryDial, countryIso2, countryLabel, detectCountry, toE164 } from "@/lib/phone";

// react-phone-input-2 ships CommonJS; interop can nest the component one level deep.
const mod = PhoneInputModule as unknown as {
  default?: ComponentType<PhoneInputProps> & { default?: ComponentType<PhoneInputProps> };
};
const PhoneInput = (mod.default?.default ??
  mod.default ??
  PhoneInputModule) as unknown as ComponentType<PhoneInputProps>;

type Props = {
  value: string;
  country: string;
  onChange: (e164: string) => void;
  onCountry: (cc: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
};

/** Phone entry with flags; the country is pre-set from the visitor's IP (USA default). */
export function PhoneField({ value, country, onChange, onCountry, onBlur, invalid }: Props) {
  const [detected, setDetected] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    const ac = new AbortController();
    detectCountry(ac.signal).then((cc) => {
      setDetected(true);
      onCountry(cc);
      // Only seed the dial code while the field is still untouched.
      if (!touched.current && !value) onChange(`+${countryDial(cc)}`);
    });
    return () => ac.abort();
    // Detect once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PhoneInput
        country={countryIso2(country)}
        value={value}
        enableSearch
        countryCodeEditable
        inputProps={{ id: "ph", name: "phone", autoComplete: "tel", "aria-invalid": !!invalid }}
        onChange={(v, data: { countryCode?: string }) => {
          touched.current = true;
          onChange(toE164(v));
          if (data?.countryCode) onCountry(data.countryCode.toUpperCase());
        }}
        onBlur={() => onBlur?.()}
        containerClass="mt-1 w-full"
        inputClass={`!h-11 !w-full !rounded-md !border !bg-background !text-base !text-foreground ${
          invalid ? "!border-destructive" : "!border-input"
        }`}
        buttonClass="!rounded-l-md !border !border-input !bg-muted"
        dropdownClass="!bg-popover !text-popover-foreground"
        searchClass="!bg-popover !text-popover-foreground"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {detected ? `Auto-detected ${countryLabel(country)}` : "Detecting your country…"} •
        We&apos;ll call this number — +91 numbers can call USA if international is enabled.
      </p>
    </div>
  );
}
