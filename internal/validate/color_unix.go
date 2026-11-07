//go:build linux || darwin

package validate

import (
	"os"
	"syscall"
	"unsafe"
)

// isTerminal reports whether the file is a terminal.
func isTerminal(file *os.File) bool {
	var termios syscall.Termios
	_, _, errno := syscall.Syscall6(syscall.SYS_IOCTL, file.Fd(), terminalGet, uintptr(unsafe.Pointer(&termios)), 0, 0, 0)
	return errno == 0
}
