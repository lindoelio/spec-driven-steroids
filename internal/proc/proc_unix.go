//go:build !windows

// Package proc answers whether a process is still running.
//
// The lock files record the process that owns them, so a lock left by a
// process that died can be recovered instead of blocking the next writer.
package proc

import "syscall"

// Alive reports whether the process with the given id is still running.
//
// The signal zero asks the kernel about the process without touching it. A
// permission error means the process exists and belongs to another user, so
// it is alive as well.
func Alive(pid int) bool {
	err := syscall.Kill(pid, 0)
	if err == nil {
		return true
	}
	return err == syscall.EPERM
}
