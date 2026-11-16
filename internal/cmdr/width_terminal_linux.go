//go:build linux

package cmdr

import (
	"os"
	"syscall"
	"unsafe"
)

// terminalGet is the ioctl request that reads the terminal attributes.
const terminalGet = syscall.TCGETS

// terminalIsTerminal reports whether the file is a terminal.
func terminalIsTerminal(file *os.File) bool {
	var termios syscall.Termios
	_, _, errno := syscall.Syscall6(syscall.SYS_IOCTL, file.Fd(), terminalGet, uintptr(unsafe.Pointer(&termios)), 0, 0, 0)
	return errno == 0
}
