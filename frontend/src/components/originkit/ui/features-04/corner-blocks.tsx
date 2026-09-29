"use client";

const LEFT_CELLS = [
  "col-start-2 row-start-1",
  "col-start-1 row-start-2",
  "col-start-2 row-start-3",
  "col-start-1 row-start-4",
];

const RIGHT_CELLS = [
  "col-start-1 row-start-1 desktop-sm:col-start-2",
  "col-start-2 row-start-2 desktop-sm:col-start-1",
  "col-start-1 row-start-3 desktop-sm:col-start-2",
  "col-start-2 row-start-4 desktop-sm:col-start-1",
];

const BlockGrid = ({ cells }: { cells: string[] }) => (
  <div className="grid shrink-0 grid-cols-[repeat(2,34.996px)] grid-rows-[repeat(4,34.996px)] gap-[0.67px] ipad:grid-cols-[repeat(2,52px)] ipad:grid-rows-[repeat(4,52px)] ipad:gap-px">
    {cells.map((cell) => (
      <span key={cell} className={`bg-[#ededed] opacity-80 ${cell}`} />
    ))}
  </div>
);

export const CornerBlocks = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute top-px left-[calc(50%-8.36px)] flex w-[872.99px] -translate-x-1/2 gap-[178.34px] pl-[286.42px] ipad:left-[calc(50%-0.29px)] ipad:w-[1296px] ipad:gap-[425px] ipad:pl-[319px] desktop-sm:top-[4px] desktop-sm:left-[72px] desktop-sm:w-auto desktop-sm:translate-x-0 desktop-sm:gap-[1008px] desktop-sm:pl-[54px]"
  >
    <BlockGrid cells={LEFT_CELLS} />
    <BlockGrid cells={RIGHT_CELLS} />
  </div>
);