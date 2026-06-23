import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'pb-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pb-dropdown.component.html',
  styleUrls: ['./pb-dropdown.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PbDropdownComponent),
      multi: true,
    },
  ],
})
export class PbDropdownComponent implements ControlValueAccessor {

  @Input() options: any[] = [];
  @Input() placeholder: string = 'Seleziona...';
  @Input() labelKey: string = 'nome';
  @Input() valueKey: string = 'id';

  isOpen = false;
  internalValue: any = null;
  disabled = false;

  onChange: any = () => {};
  onTouched: any = () => {};

  get displayText(): string {
    if (this.internalValue === null || this.internalValue === undefined || this.internalValue === '') {
      return this.placeholder;
    }
    const found = this.findOption(this.internalValue);
    if (found !== undefined) {
      return this.getLabel(found);
    }
    return this.placeholder;
  }

  toggleOpen() {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  selectOption(opt: any) {
    const val = this.getValue(opt);
    this.internalValue = val;
    this.onChange(val);
    this.onTouched();
    this.close();
  }

  isSelected(opt: any): boolean {
    return this.valueEquals(this.getValue(opt), this.internalValue);
  }

  getLabel(opt: any): string {
    if (opt === null || opt === undefined) return '';
    if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
    if (this.labelKey && opt[this.labelKey] !== undefined) return opt[this.labelKey];
    return String(opt);
  }

  getValue(opt: any): any {
    if (opt === null || opt === undefined) return opt;
    if (typeof opt === 'string' || typeof opt === 'number') return opt;
    if (this.valueKey && opt[this.valueKey] !== undefined) return opt[this.valueKey];
    return opt;
  }

  private findOption(value: any): any {
    return this.options.find(opt => this.valueEquals(this.getValue(opt), value));
  }

  private valueEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == b) return true;
    return false;
  }

  writeValue(value: any): void {
    this.internalValue = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
