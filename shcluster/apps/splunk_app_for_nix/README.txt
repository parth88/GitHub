Copyright (C) 2005-2015 Splunk Inc. All Rights Reserved.

App:                Splunk App for Unix and Linux
Current Version:    5.0.2
Last Modified:      2015-05-14
Splunk Version:     5.x,6.x
Author:             Splunk, Inc.


The Splunk App for Unix and Linux provides general health monitoring reports and metrics for Unix-based operating systems. The app includes support for a variety of different metrics available through various sources, including:

	* CPU statistics via the 'sar', 'mpstat' and 'iostat' commands (cpu.sh scripted input).

	* Free disk space available for each mount via the 'df' command (df.sh scripted input).

	* Hardware information - cpu type, count, cache; hard drives; network interface cards, count; and memory via 'dmesg', 'iostat', 'ifconfig', 'df' commands (hardware.sh scripted input).
	
	* Information about the configured network interfaces via the 'ifconfig' and 'dmesg' commands (interfaces.sh scripted input)

	* Input/output statistics for devices and partitions via 'iostat' command (iostat.sh scripted input).

	* Last login times for system accounts via 'last' command (lastlog.sh scripted input)

	* Information about files opened by processes via 'lsof' command (lsof.sh scripted input).

	* Network connections, routing tables and network interface statistics via 'netstat' command (netstat.sh scripted input).

	* Available network ports via 'netstat' command (openPorts.sh scripted input).

	* Information about software packages or sets that are installed on the system via 'dpkg-query', 'pkginfo', 'pkg_info' commands (package.sh scripted input).

	* Information about TCP/UDP transfer statistics via 'netstat' command (protocol.sh scripted input).

	* Status of current running processes via 'ps' command (ps.sh scripted input).

	* Audit information recorded by auditd daemon to /var/log/audit/audit.log (rlog.sh scripted input).

	* System date and time and the NTP server time via 'date' and 'ntpdate' commands (time.sh scripted input).

	* List of running system processes via 'top' command (top.sh scripted input).

	* User attribute information for the local system via /etc/passwd file (usersWithLoginPrivs.sh scripted input).

	* Process related memory usage information via 'top', 'vmstat' and 'ps' commands (vmstat.sh scripted input).

	* Information of all users currently logged in via 'who' command (who.sh scripted input).


##### Documentation #####

To get the most up-to-date information on how to install, configure, and use the Splunk App for Unix and Linux, visit the on-line documentation on a computer with access to the Internet:

http://docs.splunk.com/Documentation/UnixApp/latest/User/AbouttheSplunkAppforUnix

###### Get Help ######

  * Questions and answers (Unix app specific): http://answers.splunk.com/questions/tagged/unix
  * Questions and answers (General Splunk): http://answers.splunk.com
  * General support: http://www.splunk.com/support
  * The Splunk Internet Relay Chat channel (#splunk on EFNet)
