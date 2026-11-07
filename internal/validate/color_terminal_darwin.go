//go:build darwin

package validate

import "syscall"

// terminalGet is the ioctl request that reads the terminal attributes.
const terminalGet = syscall.TIOCGETA
