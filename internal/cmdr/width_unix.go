//go:build unix

package cmdr

import (
	"os"
	"syscall"
	"unsafe"
)

// terminalWidth returns the number of columns of the terminal behind the
// file, or zero when the file is not a terminal.
func terminalWidth(file *os.File) int {
	if file == nil {
		return 0
	}
	var size struct {
		rows    uint16
		columns uint16
		x       uint16
		y       uint16
	}
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, file.Fd(),
		uintptr(syscall.TIOCGWINSZ), uintptr(unsafe.Pointer(&size)))
	if errno != 0 {
		return 0
	}
	return int(size.columns)
}

// IsTerminal reports whether the file is a terminal.
//
// A character device alone is not enough: /dev/null is one, and a process
// reading from it is not interactive. The terminal attributes query only
// succeeds on a real terminal.
func IsTerminal(file *os.File) bool {
	if file == nil {
		return false
	}
	return terminalIsTerminal(file)
}
