# Embedded Checks

Bare-metal firmware, IoT, microcontrollers, and resource-constrained systems.

## Embedded Domain Signals

- `Makefile` with cross-compiler targets
- `*.c` / `*.h` files with `#include <avr/io.h>`, `<stm32f4xx.h>`, etc.
- `Cargo.toml` with `no_std` or bare-metal targets
- `board/` or `firmware/` directories
- CMakeLists.txt with embedded toolchain
- Zephyr, FreeRTOS, Embedded Linux indicators
- `STM32`, `Cortex-M`, `ARM` in comments or includes

## ARM Cortex-M Specific Checks

When targeting ARM Cortex-M processors:

### ISR Attribute Check (CRITICAL)

```c
// WRONG - missing interrupt attribute
void SysTick_Handler(void) {
    // ...
}

// CORRECT - with interrupt attribute
void SysTick_Handler(void) __attribute__((interrupt));
// or
__attribute__((interrupt))
void SysTick_Handler(void) {
    // ...
}
```

**Check:** All ISR handler functions must have `__attribute__((interrupt))` or equivalent CMSIS interrupt attribute. Without this, the compiler may not generate proper stack frame preservation.

### Interrupt Handler Naming

```
Cortex-M vector table requires exact names:
- SysTick_Handler    (System Tick)
- HardFault_Handler  (Hard Fault)
- NMI_Handler        (Non-Maskable Interrupt)
- SVC_Handler        (Supervisor Call)
- PendSV_Handler      (Pendable Service Call)
```

**Check:** ISR names match Cortex-M vector table exactly.

## Embedded-Specific Check Categories

### 1. Build & Toolchain

```
- Cross-compiler toolchain installed and configured
- Correct target architecture (ARM, AVR, RISC-V, etc.)
- Linker script correct for target
- Memory layout fits device constraints
- No standard library assumptions (no_std)
- Startup code present and correct
```

### 2. Memory Safety

```
- No heap allocation (or bounded heap)
- Stack size fits in RAM
- No stack overflow
- No uninitialized variables
- No buffer overflow
- No integer overflow in size calculations
- Alignment requirements met
```

### 3. Power & Performance

```
- No busy-wait loops without timeout
- Interrupt handlers are short
- Clock configuration correct
- Sleep modes used when idle
- DMA used for bulk transfers
- Watchdog fed in long operations
```

### 4. Hardware Interfaces

```
- GPIO pins configured correctly (input/output, pull-up/down)
- I2C/SPI timing meets spec
- ADC readings stable (averaging, debouncing)
- PWM frequency and duty cycle correct
- UART baud rate matches partner device
```

### 5. Error Handling

```
- All error codes handled
- Watchdog reset on hang
- Brown-out detection configured
- Invalid state transitions prevented
- Defensive checks on input values
```

### 6. Code Quality

```
- No floating point in interrupt context
- Volatile used for hardware registers
- Const used for flash data
- Atomic operations for shared data
- No recursion (stack limited)
```

## Quick Embedded Checks

Run these first (fast, high signal):

```bash
# Cross-compile check (syntax only, no target hardware)
arm-none-eabi-gcc -fsyntax-only -c firmware.c
# or
rustup target add thumbv7em-none-eabihf
cargo check --target thumbv7em-none-eabihf

# Size check
arm-none-eabi-size firmware.elf
# or
cargo bloat --release

# Linker map analysis
arm-none-eabi-objdump -t firmware.elf | grep -E '(\.text|\.data|\.bss)'
```

## Embedded Check Examples

### Example: Rust no_std Check

```rust
#![no_std]
#![no_main]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}  // Check: Panic handler halts (no_std has no std::process)
}

#[no_mangle]
pub extern "C" fn main() -> ! {
    // Check: Main never returns (embedded convention)
    loop {
        // Check: Volatile access for hardware
        let led = unsafe { &*(0x40021000 as *const u32) };
        *led = 0xFF;  // Turn on LED
    }
}
```

**Check清单:**
- [ ] `#![no_std]` present for bare-metal
- [ ] `#![no_main]` or `_start` symbol correct
- [ ] Panic handler present (required in no_std)
- [ ] Main never returns (infinite loop convention)
- [ ] Volatile for hardware registers
- [ ] `unsafe` blocks minimal and documented

### Example: C Interrupt Handler Check

```c
// interrupt.c
volatile uint32_t* const LED = (uint32_t*) 0x40021000;

void SysTick_Handler(void) {
    // Check: Interrupt handlers are short (no blocking)
    // Check: No floating point in ISR
    // Check: Volatile for shared data
    
    static uint32_t tick_count = 0;  // Check: Static for persistence
    tick_count++;
    
    if (tick_count >= 1000) {
        *LED ^= 0xFF;  // Toggle LED (volatile access)
        tick_count = 0;
    }
    // Check: No complex logic in ISR
}
```

**Check清单:**
- [ ] ISR functions are short
- [ ] No floating point in ISR
- [ ] Volatile for hardware registers
- [ ] Static variables for persistence
- [ ] No blocking operations (no malloc, printf, etc.)

## Common Embedded Bugs

| Bug | Symptom | Check |
|-----|---------|-------|
| Stack overflow | Random crashes | Stack size analysis |
| Heap fragmentation | Memory exhaustion | No dynamic allocation |
| Watchdog timeout | Unexpected reset | Watchdog fed regularly |
| Integer overflow | Security bypass | Bounds checking on math |
| Uninitialized RAM | Unpredictable behavior | Initialize all variables |
| Missing volatile | Hardware race | Hardware regs marked volatile |
| ISR attribute missing | Stack corruption on ARM | `__attribute__((interrupt))` on handlers |
| Overflow in comparisons | Logic errors | `tick_count > button_presses + 500` can overflow |

## Integer Overflow in Comparisons

**Dangerous pattern:**
```c
uint32_t button_presses = 0;
// If button_presses is close to UINT32_MAX, adding 500 overflows
if (tick_count > button_presses + 500) {  // OVERFLOW RISK
```

**Safe comparison:**
```c
// Safe: check overflow won't affect comparison
if (tick_count > button_presses && tick_count > button_presses + 500) {
// or
if ((int32_t)(tick_count - button_presses) > 500) {
```

**Check:** All arithmetic in comparisons with unsigned integers can overflow. Use safe subtraction-based comparisons.
