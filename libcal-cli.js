const os = require("os");
const path = require("path");
const fs = require("fs");
/*
 * the page size when getting seats from libcal. Higher value means we get more seats.
 * 2000 means we get all the seats of the library (I think there's about 1700 seats)
 */
const PAGESIZE = 2000;

/*
 * page index starting at 0 to not miss any seats
 */
const PAGEINDEX = 0;

/*
 * this is the location id of the library (I think exclusively)
 */
const LID = 1443;

/*
 * group id of 0 means we target all seats
 */
const GID = 0;

/*
 * eid of -1 means we target all seats
 */
const EID = -1;

/*
 * zone of 0 means we target all floors
 */
const ZONE = 0;

/*
 * no clue why, but it works
 */
const CAPACITY = -1;

/*
 * minimum duration required to consider a booking
 */
const MIN_DURATION = 2 * 60 * 60 * 1000;

/*
 * rug email extension
 */
const EMAIL_BASE = "@student.rug.nl";

/*
 * headers required for POST requests to libcal
 */
const HEADERS = {
  "User-Agent": "Mozilla/5.0 ...",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  Origin: "https://libcal.rug.nl",
  Referer: `https://libcal.rug.nl/r/new/availability?lid=${LID}&zone=${ZONE}&gid=${GID}&capacity=${CAPACITY}`,
  Cookie: "usernameType=student; ...",
  DNT: "1",
  "Sec-GPC": "1",
};

/*
 * First section deals with inputting arguments and making the
 * appropriate function calls.
 */

(async () => {
  const args = process.argv.slice(2); // skip node and script path

  if (args.length === 0) {
    showUsage();
  }

  const command = args[0];

  /*
   * Book command
   */
  if (command === "book") {
    if (args.length < 2) {
      showUsage();
    }

    const seat = args[1];
    let day = 0; // default day (+0)
    let groupSize = 1; // default group size

    // parse optional arguments
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--day=+")) {
        const value = arg.split("+")[1];
        if (!/^[0-4]$/.test(value)) {
          console.error(`Invalid --day value: ${value}`);
          process.exit(1);
        }
        day = parseInt(value, 10);
      } else if (arg.startsWith("--group=")) {
        const value = arg.split("=")[1];
        if (!/^\d+$/.test(value)) {
          console.error(`Invalid --group value: ${value}`);
          process.exit(1);
        }
        groupSize = parseInt(value, 10);
      } else {
        console.error(`Unknown argument: ${arg}`);
        showUsage();
      }
    }

    // try to make booking
    let profile;
    try {
      profile = loadProfile();
    } catch (e) {
      console.log(e.message);
    }
    if (
      !(
        profile.email &&
        profile.fname &&
        profile.lname &&
        profile.phone &&
        profile.snum
      )
    ) {
      console.log("Profile incomplete");
      console.log(
        "Run `libcal-cli profile` to view which attributes are missing",
      );
      showUsage();
    }
    if (!profile.mod) {
      profile.mod = 0;
    } // profile.mod is not initialized by user
    if (!(groupSize > 1)) {
      await book(seat, day, profile);
    } else {
      await book_group(seat, day, groupSize, profile);
    }
    try {
      saveProfile(profile);
    } catch (e) {
      console.log("Failed to save profile after booking.");
      console.log(
        "This may result in errors when trying to make more bookings, to mitigate these cancel current booking(s).",
      );
    }

    /*
     * Checkin command
     */
  } else if (command === "checkin") {
    if (args.length !== 2) {
      console.error('Error: "checkin" requires a <code> argument.');
      showUsage();
    }

    const code = args[1];
    console.log('Parsed "checkin" command:');
    console.log(`  Code: ${code}`);

    // TODO: make checkin command

    /*
     * Profile command
     */
  } else if (command === "profile") {
    let profile;
    try {
      profile = loadProfile();
    } catch (e) {
      profile = {};
    }
    if (args.length == 1) {
      console.log("first name: ", profile.fname);
      console.log("last name: ", profile.lname);
      console.log("phone number: ", profile.phone);
      console.log("email: ", profile.email);
      console.log("student number: ", profile.snum);
    }

    // parse all optional arguments
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--email=")) {
        const value = arg.split("=")[1];
        if (!/^.+@student\.rug\.nl$/.test(value)) {
          console.error(`Invalid --email value: ${value}`);
          continue;
        }
        profile.email = value;
        console.log("Updated email address.");
      } else if (arg.startsWith("--phone=")) {
        const value = arg.split("=")[1];
        if (!/^\d{7,11}$/.test(value)) {
          console.error(`Invalid --phone value: ${value}`);
          continue;
        }
        profile.phone = value;
        console.log("Updated phone number.");
      } else if (arg.startsWith("--fname=")) {
        const value = arg.split("=")[1];
        profile.fname = value;
        console.log("Updated first name.");
      } else if (arg.startsWith("--lname=")) {
        const value = arg.split("=")[1];
        profile.lname = value;
        console.log("Updated last name.");
      } else if (arg.startsWith("--snum=")) {
        const value = arg.split("=")[1];
        if (!/^s\d{7}$/.test(value)) {
          console.error(`Invalid --snum value: ${value}`);
          continue;
        }
        console.log("Updating student number.");
        profile.snum = value;
      } else {
        console.error(`Unknown argument: ${arg} ignored`);
      }
    }
    saveProfile(profile);
  } else {
    console.error(`Unknown command: ${command}`);
    showUsage();
  }
})();

/*
 * Show usage of libcal-cli and exit
 */
function showUsage() {
  console.log(`
Usage:
  libcal-cli book <seat> [--day=+N] [--group=SIZE]
  libcal-cli checkin <code>
  libcal-cli profile [--fname=<first_name>] [--lname=<last_name>] [--phone=<phone_number>] [--email=<email>] [--snum=<student_number>]
  `);
  process.exit(1);
}

/*
 * this section defines the functions used for booking and checking in, they use
 * other functions defined later which handle the interaction with libcal.
 */

/*
 * book a single seat
 */
async function book(seat, days, profile) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  let seats = await getSeats(date);
  seats = seats.filter((s) => s.title.startsWith(seat));
  if (seats.length <= 0) {
    console.log("No seat matching the criteria was found.");
    return;
  }

  seats.forEach((s) => {
    s.duration = duration(s);
  });

  let best_seat = seats[0];
  for (const seat of seats) {
    if (seat.duration > best_seat.duration) {
      best_seat = seat;
    }
  }

  if (best_seat.duration < MIN_DURATION) {
    console.log("No available seat matching the criteria was found");
  } else {
    let b;
    try {
      const email_start = profile.email.split("@")[0];
      profile.mod++;
      b = await bookSeat(
        seats[0],
        email_start,
        profile.mod,
        profile.fname,
        profile.lname,
        profile.phone,
        profile.snum,
      );
    } catch (e) {
      console.log("Something went wrong: ", e);
      return;
    }
    console.log(`Booked seat ${b.seat} from ${b.start} until ${b.end}.`);
  }
}

/*
 * book adjacent seats
 */
async function book_group(seat, days, group, profile) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  let seats = await getSeats(date);
  seats = seats.filter((s) => s.title.startsWith(seat));
  if (seats.length < group) {
    console.log("Not enough seats matching the criteria were found");
  }

  seats.forEach((s) => {
    s.duration = duration(s);
  });

  // find first #group of adjacent seat satisfying minimum booking duration
  // and store last value in k
  let k = -1;
  let done = 0;
  while (done != group && k < seats.length) {
    k++;
    if (seats[k].duration >= MIN_DURATION) {
      done++;
    } else {
      done = 0;
    }
  }

  if (done != group) {
    console.log("Not enough seats matching the criteria were found");
    return;
  }

  // calculate mean booking duration for selected k
  let prev = 0;
  for (let i = k - group + 1; i <= k; i++) {
    prev += seats[i].duration / group;
  }

  // sliding window going forward to find group of adjacent seats
  // with highest mean booking duration
  let best = prev;
  let best_i = k;
  for (let i = k + 1; i < seats.length; i++) {
    if (!seats[i].duration >= MIN_DURATION) {
      continue;
    }
    const val =
      prev - seats[i - group].duration / group + seats[i].duration / group;
    if (val >= best) {
      best_i = i;
      best = val;
    }
  }

  const email_start = profile.email.split("@")[0];
  for (let i = best_i; i < group + best_i; i++) {
    try {
      profile.mod++;
      const b = await bookSeat(
        seats[i],
        email_start,
        profile.mod,
        profile.fname,
        profile.lname,
        profile.phone,
        profile.snum,
      );
      console.log(`Booked seat ${b.seat} from ${b.start} until ${b.end}.`);
    } catch (e) {
      console.log("Something went wrong: ", e);
    }
  }
}

/*
 * Get duration of a booking
 */
function duration(seat) {
  const start = new Date(seat.availabilities?.[0]?.[0]);
  if (!start) {
    return 0;
  }
  const end = new Date(
    seat.availabilities?.[seat.availabilities.length - 1]?.[1] ?? start,
  );
  return end - start;
}

/*
 * Get configuration path where profile is stored
 */
function getConfigPath() {
  const platform = os.platform();
  let baseDir;

  if (platform === "win32") {
    baseDir = process.env.APPDATA;
  } else if (platform === "darwin") {
    baseDir = path.join(os.homedir(), "Library", "Application Support");
  } else {
    baseDir = path.join(os.homedir(), ".config");
  }

  const configDir = path.join(baseDir, "libcal-cli");
  const configFile = path.join(configDir, "profile.json");

  return { configDir, configFile };
}

function saveProfile(profile) {
  const { configDir, configFile } = getConfigPath();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configFile, JSON.stringify(profile, null, 2));
}

function loadProfile() {
  const { configFile } = getConfigPath();

  if (!fs.existsSync(configFile)) {
    throw new Error(
      "Profile not found. Please run `libcal-cli profile --email=<email> --phone=<phone> --snum<student_number>` to set it up.",
    );
  }

  return JSON.parse(fs.readFileSync(configFile, "utf-8"));
}

/*
 *
 * this section stores functions which handle interaction with libcal
 *
 */

/*
 * Get a list of existing seats from libcal
 * TODO: Split up into get seats, and get availabilities
 */
async function getSeats(date) {
  const url = `https://libcal.rug.nl/r/new/availability?lid=${LID}&zone=${ZONE}&gid=${GID}&capacity=${CAPACITY}`;
  let htmlRes;
  let html;
  try {
    htmlRes = await fetch(url);
  } catch (e) {
    throw e;
  }
  try {
    html = await htmlRes.text();
  } catch (e) {
    throw e;
  }

  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  const htmlSeats = [
    ...html.matchAll(/resources\.push\(\s*({[\s\S]*?})\s*\);/g),
  ]; // get json structures representing seats
  const seats = Object.fromEntries(
    // build object with 'seatId : seatObj'
    htmlSeats.map((htmlSeat) => {
      try {
        // Convert object string to valid JSON
        let objString = htmlSeat[1]
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
          .replace(/'/g, '"')
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]");

        const seat = JSON.parse(objString);
        seat.availabilities = [];
        seat.startDate = date.toISOString().split("T")[0];
        seat.endDate = endDate.toISOString().split("T")[0];

        return [seat.seatId, seat];
      } catch (e) {
        throw e;
      }
    }),
  );

  // form data for second request (POST), which gathers availabilities/checksums
  const formData = new URLSearchParams({
    lid: LID.toString(),
    gid: GID.toString(),
    eid: EID.toString(),
    seat: "1",
    seatId: "0",
    zone: ZONE.toString(),
    start: date.toISOString().split("T")[0], // start date to be changed
    end: endDate.toISOString().split("T")[0], // end date to be changed (start date +1)
    pageIndex: PAGEINDEX.toString(),
    pageSize: PAGESIZE.toString(), // this needs to be set to like 2000 in the final version, to get all the checksums
  });

  // make second request
  const addRes = await fetch("https://libcal.rug.nl/spaces/availability/grid", {
    method: "POST",
    headers: HEADERS,
    body: formData.toString(),
  });

  // parse JSON
  const addResJSON = await addRes.json();

  // attach availabilities and checksums to seat objects
  const slots = Object.values(addResJSON.slots);
  slots.forEach((slot) => {
    if (!slot.className) {
      seats[slot.itemId].availabilities.push([
        slot.start,
        slot.end,
        slot.checksum,
      ]);
    }
  });

  var resultSeats = Object.values(seats);

  // get only available seats
  resultSeats = resultSeats.filter((seat) => {
    return !(seat.availabilities.length == 0);
  });

  return resultSeats;
}

/*
 * Function handling the interaction with libcal in order to book a seat
 * TODO: Split up function into it's different components
 * (define start of booking, define end of booking, confirm booking)
 */
async function bookSeat(seat, email, mod, fname, lname, phone, student_number) {
  let res1;
  try {
    res1 = await fetch(
      "https://libcal.rug.nl/spaces/availability/booking/add",
      {
        method: "POST",
        headers: HEADERS,
        body: new URLSearchParams({
          "add[eid]": seat.eid.toString(),
          "add[seat_id]": seat.seatId.toString(),
          "add[gid]": seat.gid.toString(),
          "add[lid]": seat.lid.toString(),
          "add[start]": seat.availabilities[0][0],
          "add[checksum]": seat.availabilities[0][2],
          lid: seat.lid.toString(), // should this be the same as seat.lid?? Not sure
          gid: seat.gid.toString(), // this is set to 0??? Not sure why either
          start: seat.startDate,
          end: seat.endDate,
        }),
      },
    );
  } catch (e) {
    throw e;
  }

  let res1JSON;
  try {
    res1JSON = await res1.json();
  } catch (e) {
    throw e;
  }

  if (
    !res1JSON.bookings ||
    !Array.isArray(res1JSON.bookings) ||
    res1JSON.bookings.length === 0
  ) {
    throw Error("Unexpected response");
  }

  var booking = res1JSON.bookings[0];

  const res2 = await fetch(
    "https://libcal.rug.nl/spaces/availability/booking/add",
    {
      method: "POST",
      headers: HEADERS,
      body: new URLSearchParams({
        "update[id]": booking.id.toString(),
        "update[checksum]":
          booking.optionChecksums[booking.optionChecksums.length - 1],
        "update[end]": booking.options[booking.options.length - 1], // get longest booking possible
        lid: booking.lid.toString(),
        gid: GID.toString(),
        start: seat.startDate,
        end: seat.endDate,
        "bookings[0][id]": booking.id.toString(),
        "bookings[0][eid]": booking.eid.toString(),
        "bookings[0][seat_id]": booking.seat_id.toString(),
        "bookings[0][gid]": booking.gid.toString(),
        "bookings[0][lid]": booking.lid.toString(),
        "bookings[0][start]": booking.start,
        "bookings[0][end]": booking.end,
        "bookings[0][checksum]": booking.checksum,
      }),
    },
  );

  let res2JSON;
  try {
    res2JSON = await res2.json();
  } catch (e) {
    throw e;
  }

  booking = res2JSON.bookings[0];

  function buildReturnUrl({ lid, gid, zone, capacity, date, start, end }) {
    const params = new URLSearchParams({
      lid,
      gid,
      zone,
      capacity,
      date,
      start,
      end,
    });
    return `/r/new?${params.toString()}`;
  }

  const bookingData = {
    session: "1", //36797124
    fname: fname,
    lname: lname,
    email: `${email}+${mod}${EMAIL_BASE}`,
    q731: phone, // phone number
    q749: student_number, // student number
    bookings: JSON.stringify([
      {
        id: booking.id,
        eid: booking.eid,
        seat_id: booking.seat_id,
        gid: booking.gid,
        lid: booking.lid,
        start: booking.start,
        end: booking.end,
        checksum: booking.checksum,
      },
    ]),
    returnUrl: buildReturnUrl({
      lid: booking.lid,
      gid: GID, // wtf???
      zone: ZONE,
      capacity: CAPACITY,
      date: seat.startDate,
      start: "",
      end: "",
    }),
    pickupHolds: "",
    method: "13", // magic number 🌈
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(bookingData)) {
    formData.append(key, value);
  }

  // Send the request
  let res;
  try {
    res = await fetch("https://libcal.rug.nl/ajax/space/book", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Origin: "https://libcal.rug.nl",
        Referer: `https://libcal.rug.nl/r/new/availability?lid=${LID}&zone=${ZONE}&gid=${GID}&capacity=${CAPACITY}`,
      },
      body: formData,
      credentials: "include",
    });
  } catch (e) {
    throw e;
  }

  if (!res.ok) {
    const rsss = await res.text();
    console.log(rsss);
    throw new Error("request rejected by server");
  }

  return {
    seat: seat.title,
    start: booking.start,
    end: booking.end,
  };
}
