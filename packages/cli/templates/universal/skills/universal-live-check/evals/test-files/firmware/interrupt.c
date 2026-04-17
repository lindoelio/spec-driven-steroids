#include <stdint.h>
#include <stm32f4xx.h>

volatile uint32_t* const LED = (uint32_t*) 0x40021000;
volatile uint32_t* const BUTTON = (uint32_t*) 0x40020800;

static uint32_t tick_count = 0;
static uint32_t button_presses = 0;

void SysTick_Handler(void) {
    tick_count++;

    if (tick_count % 1000 == 0) {
        *LED ^= 0xFF;
    }

    if ((*BUTTON & 0x1) && tick_count > button_presses + 500) {
        button_presses = tick_count;
    }
}

void HardFault_Handler(void) {
    while(1) {}
}

void NMI_Handler(void) {
    *LED = 0xFF;
    while(1) {}
}
