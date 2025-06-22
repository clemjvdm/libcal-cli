## Install

Download the appropriate binary, on Linux and MacOS make sure to decompress the files:
```
tar -zxvf libcal-cli-linux.tar.gz
```

Now on MacOS and Linux you can run the program with:

```
./libcal-cli
```

and on Windows with:

```on
./libcal-cli.exe
```

Add it to path to be able to access it from anywhere.

## Usage

`libcal-cli` with no arguments shows the usage. The first time you run it, it will say you need to complete a profile. Do this with:

```
libcal-cli profile --fname=<name> --lname=<name> --phone=<phone#> --email=<student_email> --snum=<student_number>
```

Note the following:

- phone number should be 9-10 characters longs
- email **has to be a student email**; ending with '@student.rug.nl'
- student number should start with an s. For example 's5091342'

#### Booking a Seat

Simply run `libcal-cli book <seat>`, where the seat can be either a specific seat (ex. `3.A.123`), or just an area or a floor like: `3.A` and `3`. In which case the seat in that region with the longest possible booking duration will be picked.

By default libcal-cli will book a seat for the current date. To book a seat for another date use

```
libcal-cli book <seat> --day=+<days>
```

For example `libcal-cli book 3.A --day=+1` will book a seat for the one day after the current date. Note the maximum is 4 days in the future.

#### Booking Seats as a Group

You can use the `--group=<seat_count>` option to specify you'd like to book more than one seat. In this case libcal-cli will try to book so many adjacent seats.

