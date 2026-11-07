package validate

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

// The ANSI escape sequences of the colors the previous release used through
// chalk.
const (
	colorReset  = "\x1b[39m"
	colorRed    = "\x1b[31m"
	colorGreen  = "\x1b[32m"
	colorYellow = "\x1b[33m"
	colorGray   = "\x1b[90m"
)

var terminalPattern = regexp.MustCompile(`(?i)^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux`)

// red wraps a value in the ANSI sequence of the red color.
func red(value string) string {
	return colorize(colorRed, value)
}

// green wraps a value in the ANSI sequence of the green color.
func green(value string) string {
	return colorize(colorGreen, value)
}

// yellow wraps a value in the ANSI sequence of the yellow color.
func yellow(value string) string {
	return colorize(colorYellow, value)
}

// gray wraps a value in the ANSI sequence of the gray color.
func gray(value string) string {
	return colorize(colorGray, value)
}

// colorize wraps a value in the ANSI sequence of a color. The color is closed
// and reopened around every line break, the way chalk does it.
func colorize(open string, value string) string {
	if value == "" || !colorsEnabled() {
		return value
	}
	return open + strings.ReplaceAll(value, "\n", colorReset+"\n"+open) + colorReset
}

// colorLevel caches the color decision, the way the chalk runtime of the
// previous release decides it once at startup.
var colorLevel = sync.OnceValue(func() bool {
	return detectColors()
})

// colorsEnabled reports whether the standard output supports colors. The
// decision follows the runtime of the previous release: the FORCE_COLOR
// environment variable wins, a terminal is required and the CI environment
// decides on its own.
func colorsEnabled() bool {
	return colorLevel()
}

// detectColors reads the environment and the terminal of the standard output.
func detectColors() bool {
	if level, forced := forceColorLevel(); forced {
		return level > 0
	}

	if _, ok := os.LookupEnv("TF_BUILD"); ok {
		if _, ok := os.LookupEnv("AGENT_NAME"); ok {
			return true
		}
	}

	if !isTerminal(os.Stdout) {
		return false
	}

	term := os.Getenv("TERM")
	if term == "dumb" {
		return false
	}

	if _, ok := os.LookupEnv("CI"); ok {
		for _, key := range []string{"GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI", "TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"} {
			if _, ok := os.LookupEnv(key); ok {
				return true
			}
		}
		return os.Getenv("CI_NAME") == "codeship"
	}

	if os.Getenv("COLORTERM") == "truecolor" {
		return true
	}
	if strings.HasSuffix(term, "-256") || strings.HasSuffix(term, "-256color") {
		return true
	}
	if terminalPattern.MatchString(term) {
		return true
	}
	_, hasColorTerm := os.LookupEnv("COLORTERM")
	return hasColorTerm
}

// forceColorLevel reads the FORCE_COLOR environment variable.
func forceColorLevel() (int, bool) {
	value, ok := os.LookupEnv("FORCE_COLOR")
	if !ok {
		return 0, false
	}
	switch value {
	case "true":
		return 1, true
	case "false":
		return 0, true
	case "":
		return 1, true
	}
	level, err := strconv.Atoi(value)
	if err != nil {
		return 1, true
	}
	return level, true
}
