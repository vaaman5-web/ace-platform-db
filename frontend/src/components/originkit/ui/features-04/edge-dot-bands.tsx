"use client";

const DOT_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="453" height="725"><rect width="292" height="408" rx="42" fill="#000000" fill-opacity="0.1"/></svg>',
)}")`;

const BAR =
  "pointer-events-none absolute bottom-0 w-[41px] bg-[length:4.5277px_7.2514px] ipad:w-[51px] ipad:bg-[length:4.5277px_6.2024px] desktop-sm:w-[71px] desktop-sm:bg-[length:4.5277px_5.1584px]";

export const EdgeDotBands = () => (
  <>
    <div
      aria-hidden
      className={`${BAR} top-[-8.5px] left-[2.36px] ipad:left-[1.51px] desktop-sm:top-[-2.5px] desktop-sm:left-[1.5px]`}
      style={{ backgroundImage: DOT_TILE }}
    />
    {}
    <div
      aria-hidden
      className={`${BAR} top-[-9.5px] right-[-1.36px] ipad:top-[-13.5px] ipad:right-[-0.5px] desktop-sm:top-[-2.5px] desktop-sm:right-[0.5px]`}
      style={{ backgroundImage: DOT_TILE, backgroundPosition: "0 3.6px" }}
    />
  </>
);