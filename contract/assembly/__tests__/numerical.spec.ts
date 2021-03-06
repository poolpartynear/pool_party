import { random_u128 } from "../users"
import { u128 } from "near-sdk-as"


describe("u128 test", () => {
  it("returns 0 for small divisions", () => {
    const max = 100
    for(let i=0; i < max; i++){
      let div:u128 = u128.from(i) / u128.from(max)
      expect(div).toBe(u128.Zero)
    }
  })

  it("underflow raises error", () => {
    expect(()=>{ u128.Zero - u128.One }).toThrow()
    expect(()=>{ u128.from("0") - u128.from("2") }).toThrow()
    expect(()=>{ u128.from(0) - u128.from(2) }).toThrow()
  })
})

describe("Random", () => {
  it("should be random", () => {
    let trials = 100
    let max = 10
    let numbers = new Array<i32>()
    
    for(let i=0; i < max; i++){numbers.push(0)}

    for(let i=0; i < trials; i++){
      let rnd:u128 = random_u128(u128.Zero, u128.from(max))

      expect(rnd >= u128.Zero && u128.from(max) > rnd)

      for(let j=0; j < max; j++){
        if(rnd == u128.from(j)){ numbers[j] = numbers[j] + 1 }
      }
    }

    for(let i=0; i < max; i++){
      expect(numbers[i] > 5 && numbers[i] < 15).toBe(true)
    }
  });
});

describe("Random", () => {
  it("should be random from a min to a max", () => {
    let trials = 100
    let min = 3
    let max = 13
    let numbers = new Array<i32>()
    
    for(let i=0; i <= max; i++){numbers.push(0)}

    for(let i=0; i < trials; i++){
      let rnd:u128 = random_u128(u128.from(min), u128.from(max))

      expect(rnd >= u128.from(min) && u128.from(max) > rnd)

      for(let j=min; j < max; j++){
        if(rnd == u128.from(j)){ numbers[j] = numbers[j] + 1 }
      }
    }

    // Check the distribution is correct
    for(let i=min; i < max; i++){
      expect(numbers[i] > 5 && numbers[i] < 15).toBe(true)
    }
  });
});