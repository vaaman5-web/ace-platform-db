"use client";

const FADE =
  "[mask-image:linear-gradient(to_bottom,#000_250px,transparent_330px)] [-webkit-mask-image:linear-gradient(to_bottom,#000_250px,transparent_330px)] ipad:[mask-image:linear-gradient(to_bottom,#000_260px,transparent_340px)] ipad:[-webkit-mask-image:linear-gradient(to_bottom,#000_260px,transparent_340px)] desktop-sm:[mask-image:linear-gradient(to_bottom,#000_300px,transparent_380px)] desktop-sm:[-webkit-mask-image:linear-gradient(to_bottom,#000_300px,transparent_380px)]";

const ROWS = 18;

const COLUMNS = 25;

const WIDE_COLUMNS = 30;

const BAND =
  "left-[calc(50%-8.36px)] -translate-x-1/2 ipad:left-[calc(50%-0.29px)] desktop-sm:left-[72px] desktop-sm:translate-x-0";

export const GridRows = () => (
  <div
    aria-hidden
    className={`pointer-events-none absolute top-0 flex w-[872.99px] flex-col gap-[35.027px] opacity-80 ipad:w-[1296px] ipad:gap-[52px] desktop-sm:-top-[50px] desktop-sm:right-[72px] desktop-sm:w-auto ${FADE} ${BAND}`}
  >
    {Array.from({ length: ROWS }, (_, i) => (
      <span
        key={`row-${i}`}
        className="h-[0.674px] w-full shrink-0 bg-[#e0e0e0] shadow-[0px_0.674px_0px_0px_#ffffff] ipad:h-px ipad:shadow-[0px_1px_0px_0px_#ffffff]"
      />
    ))}
  </div>
);

export const GridColumns = () => (
  <div
    aria-hidden
    className={`pointer-events-none absolute top-0 flex h-[615px] w-[872.99px] items-stretch gap-[35.027px] opacity-80 ipad:h-[913px] ipad:w-[1296px] ipad:gap-[52px] desktop-sm:-top-[50px] desktop-sm:right-[72px] desktop-sm:w-auto desktop-sm:overflow-hidden ${FADE} ${BAND}`}
  >
    {Array.from({ length: COLUMNS + WIDE_COLUMNS }, (_, i) => (
      <span
        key={`col-${i}`}
        className={`w-[0.674px] shrink-0 bg-[#e0e0e0] shadow-[0.674px_0px_0px_0px_#ffffff] ipad:w-px ipad:shadow-[1px_0px_0px_0px_#ffffff] ${
          i < COLUMNS ? "" : "hidden desktop-sm:block"
        }`}
      />
    ))}
  </div>
);